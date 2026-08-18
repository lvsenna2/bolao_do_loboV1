import type { Prisma, SpecialRoundFormat, SpecialRoundStatus } from "@prisma/client";

import {
  BONUS_ROLLOVER_MULTIPLIER,
  creditWalletInTransaction,
  formatCents
} from "@/features/wallet/services/wallet-service";
import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";

import type { PrizeDistributionItem, SpecialRoundAnswer } from "../types";
import { deriveCatalogResults } from "./catalog-result-service";
import { resolveApiBackedSpecialRoundMatch } from "./match-link-service";
import { calculateSpecialRoundPrizePool, distributeSpecialRoundPrize } from "./prize-service";
import { promoReturnCents, splitPromoPayout } from "./promo-service";
import { evaluateSpecialRoundAnswer, rankSpecialRoundEntries } from "./scoring-service";
import { assertSpecialRoundTransition } from "./state-service";

const serializable = { isolationLevel: "Serializable" as const };

// Quando a partida encerra mas a API-Football nunca consolida todos os detalhes, a rodada
// ainda precisa ser apurada. Passado esse prazo desde o apito inicial, a apuracao automatica
// aceita os dados ja catalogados.
const CONSOLIDATION_GRACE_MS = 3 * 60 * 60_000;

export const settleableSpecialRoundStatuses = [
  "PREDICTIONS_OPEN",
  "PREDICTIONS_CLOSED",
  "AWAITING_RESULT",
  "CALCULATING"
] as const satisfies readonly SpecialRoundStatus[];

// A promocao aceita aposta ja em REGISTRATION_OPEN e nao passa pelas fases de palpite, entao
// ela tambem precisa entrar na varredura automatica a partir desse status.
export const settleablePromoRoundStatuses = [
  "REGISTRATION_OPEN",
  ...settleableSpecialRoundStatuses
] as const satisfies readonly SpecialRoundStatus[];

export type SpecialRoundSettlementResult = {
  message: string;
  missing?: string[];
  ok: boolean;
};

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function isSpecialRoundMatchReadyForSettlement(input: {
  fullySyncedAt: Date | null;
  kickoff: Date;
  now: Date;
  status: string;
}) {
  if (input.status !== "FINISHED") return false;
  if (input.fullySyncedAt) return true;
  return input.now.getTime() - input.kickoff.getTime() >= CONSOLIDATION_GRACE_MS;
}

export async function getSpecialRoundChampionName(
  client: Prisma.TransactionClient,
  specialRoundId: string
) {
  const champion = await client.specialRoundStanding.findFirst({
    orderBy: { position: "asc" },
    select: { entry: { select: { user: { select: { name: true } } } } },
    where: { position: 1, specialRoundId }
  });
  return champion?.entry.user.name ?? null;
}

/**
 * Credita cada premio na carteira do ganhador assim que a classificacao e publicada e marca
 * o premio como pago. O uniqueKey por premio garante que reprocessar a rodada nao credite
 * duas vezes.
 *
 * Na Rodada Promocional o premio e o retorno da propria aposta: o valor apostado volta para o
 * balde de onde saiu e so o lucro vira saldo bonus.
 */
export type SpecialRoundPrizeRoundInfo = {
  format?: SpecialRoundFormat;
  id: string;
  name: string;
  promoOdds?: Prisma.Decimal | null;
};

type CreditablePrize = {
  amount: Prisma.Decimal;
  confirmedAt: Date | null;
  entry: { amount: Prisma.Decimal; bonusAmount: Prisma.Decimal; userId: string };
  id: string;
};

/**
 * Credita um premio e marca como pago. E o unico caminho de credito de premio — a apuracao
 * automatica e o botao manual do admin passam os dois por aqui, para a promocao nunca pagar
 * lucro como saldo sacavel.
 */
export async function creditSpecialRoundPrizeToWallet(
  client: Prisma.TransactionClient,
  round: SpecialRoundPrizeRoundInfo,
  prize: CreditablePrize
) {
  const amountCents = Math.round(Number(prize.amount) * 100);
  if (amountCents <= 0) return false;

  if (round.format === "PROMO_SINGLE_SELECTION") {
    const payout = splitPromoPayout({
      bonusStakeCents: Math.round(Number(prize.entry.bonusAmount) * 100),
      odds: Number(round.promoOdds ?? 0),
      stakeCents: Math.round(Number(prize.entry.amount) * 100)
    });
    if (payout.realCreditCents > 0) {
      await creditWalletInTransaction(client, {
        amountCents: payout.realCreditCents,
        bucket: "REAL",
        description: `Valor apostado devolvido - ${round.name}`,
        relatedEntityId: prize.id,
        type: "REFUND",
        uniqueKey: `wallet:special-round:prize:${prize.id}:real`,
        userId: prize.entry.userId
      });
    }
    if (payout.bonusStakeCents > 0) {
      await creditWalletInTransaction(client, {
        amountCents: payout.bonusStakeCents,
        bucket: "ROLLOVER",
        description: `Valor apostado em bonus devolvido - ${round.name}`,
        relatedEntityId: prize.id,
        type: "REFUND",
        uniqueKey: `wallet:special-round:prize:${prize.id}:bonus-stake`,
        userId: prize.entry.userId
      });
    }
    if (payout.profitCents > 0) {
      await creditWalletInTransaction(client, {
        amountCents: payout.profitCents,
        bucket: "BONUS",
        description: `Bonus da promocao ${round.name}`,
        relatedEntityId: prize.id,
        rolloverRequirementCents: payout.profitCents * BONUS_ROLLOVER_MULTIPLIER,
        type: "BONUS",
        uniqueKey: `wallet:special-round:prize:${prize.id}:profit`,
        userId: prize.entry.userId
      });
    }
  } else {
    await creditWalletInTransaction(client, {
      amountCents,
      bucket: "ROLLOVER",
      description: `Premio da Rodada Especial ${round.name}`,
      relatedEntityId: prize.id,
      type: "BONUS",
      uniqueKey: `wallet:special-round:prize:${prize.id}`,
      userId: prize.entry.userId
    });
  }

  const now = serverNow();
  await client.specialRoundPrize.update({
    data: { confirmedAt: prize.confirmedAt ?? now, paidAt: now, status: "PAID" },
    where: { id: prize.id }
  });
  return true;
}

export async function creditSpecialRoundPrizesToWallets(
  client: Prisma.TransactionClient,
  round: SpecialRoundPrizeRoundInfo
) {
  const prizes = await client.specialRoundPrize.findMany({
    include: { entry: { select: { amount: true, bonusAmount: true, userId: true } } },
    where: { specialRoundId: round.id, status: { in: ["PENDING", "CONFIRMED"] } }
  });
  let credited = 0;

  for (const prize of prizes) {
    if (await creditSpecialRoundPrizeToWallet(client, round, prize)) credited += 1;
  }

  return credited;
}

/**
 * Devolve o valor apostado numa promocao cancelada, cada parte para o balde de onde saiu e
 * sem nenhum bonus promocional.
 */
export async function refundPromoRoundEntries(
  client: Prisma.TransactionClient,
  round: { id: string; name: string }
) {
  const entries = await client.specialRoundEntry.findMany({
    where: { paymentStatus: "APPROVED", specialRoundId: round.id }
  });
  const now = serverNow();
  let refunded = 0;

  for (const entry of entries) {
    const stakeCents = Math.round(Number(entry.amount) * 100);
    const bonusCents = Math.min(Math.round(Number(entry.bonusAmount) * 100), stakeCents);
    const realCents = stakeCents - bonusCents;
    if (stakeCents <= 0) continue;

    if (realCents > 0) {
      await creditWalletInTransaction(client, {
        amountCents: realCents,
        bucket: "REAL",
        description: `Estorno da promocao ${round.name}`,
        relatedEntityId: entry.id,
        type: "REFUND",
        uniqueKey: `wallet:promo-round:refund:${entry.id}:real`,
        userId: entry.userId
      });
    }
    if (bonusCents > 0) {
      await creditWalletInTransaction(client, {
        amountCents: bonusCents,
        bucket: "ROLLOVER",
        description: `Estorno da promocao ${round.name}`,
        relatedEntityId: entry.id,
        type: "REFUND",
        uniqueKey: `wallet:promo-round:refund:${entry.id}:bonus`,
        userId: entry.userId
      });
    }
    await client.specialRoundEntry.update({
      data: { paymentStatus: "REFUNDED", refundedAt: now },
      where: { id: entry.id }
    });
    refunded += 1;
  }

  return refunded;
}

export async function createSpecialRoundFinalizedNotifications(
  client: Prisma.TransactionClient,
  round: { format?: SpecialRoundFormat; id: string; name: string }
) {
  const isPromo = round.format === "PROMO_SINGLE_SELECTION";
  const [entries, championName] = await Promise.all([
    client.specialRoundEntry.findMany({
      include: { prize: true },
      where: { paymentStatus: "APPROVED", specialRoundId: round.id }
    }),
    isPromo ? Promise.resolve(null) : getSpecialRoundChampionName(client, round.id)
  ]);
  const resultBody = isPromo
    ? `${round.name} foi encerrada e os resultados ja estao na sua carteira.`
    : championName
      ? `A classificacao de ${round.name} foi publicada. Campeao: ${championName}.`
      : `A classificacao de ${round.name} foi publicada.`;

  await client.notification.createMany({
    data: entries.flatMap((entry) => {
      const prizeBody = entry.prize
        ? isPromo
          ? `Sua aposta em ${round.name} bateu! ${formatCents(
              Math.round(Number(entry.prize.amount) * 100)
            )} ja estao na sua carteira, com o lucro em saldo bonus.`
          : `Parabens! ${formatCents(Math.round(Number(entry.prize.amount) * 100))} de ${round.name} ja estao no saldo da sua carteira.`
        : null;

      return [
        {
          body: resultBody,
          icon: "special-round-result",
          message: resultBody,
          relatedEntityId: round.id,
          title: isPromo ? "Promocao encerrada" : "Resultado publicado",
          type: "SPECIAL_ROUND" as const,
          uniqueKey: `special-round:result:${round.id}:${entry.userId}`,
          userId: entry.userId
        },
        ...(entry.prize && prizeBody
          ? [
              {
                body: prizeBody,
                icon: "special-round-prize",
                message: prizeBody,
                relatedEntityId: entry.prize.id,
                title: isPromo ? "Aposta premiada" : "Usuario premiado",
                type: "SPECIAL_ROUND" as const,
                uniqueKey: `special-round:prize:${entry.prize.id}`,
                userId: entry.userId
              }
            ]
          : [])
      ];
    }),
    skipDuplicates: true
  });
}

export async function homologateSpecialRoundFromCatalog(input: {
  actorId: string | null;
  specialRoundId: string;
}): Promise<SpecialRoundSettlementResult> {
  try {
    const round = await prisma.specialRound.findUnique({
      include: {
        markets: {
          include: { options: { select: { value: true } } },
          where: { active: true }
        },
        match: {
          include: {
            events: {
              include: { player: { select: { id: true, name: true } } }
            },
            statistics: { select: { teamId: true, type: true, value: true } }
          }
        }
      },
      where: { id: input.specialRoundId }
    });
    if (!round?.match) throw new Error("MATCH_NOT_LINKED");

    const derived = deriveCatalogResults(
      {
        awayScore: round.match.awayScore,
        awayTeamId: round.match.awayTeamId,
        events: round.match.events,
        homeScore: round.match.homeScore,
        homeTeamId: round.match.homeTeamId,
        penaltyAway: round.match.penaltyAway,
        penaltyHome: round.match.penaltyHome,
        statistics: round.match.statistics,
        status: round.match.status
      },
      round.markets
    );
    if (derived.missing.length) {
      return {
        message: `O catalogo ainda nao possui: ${derived.missing.join(", ")}.`,
        missing: derived.missing,
        ok: false
      };
    }

    await prisma.$transaction(
      [
        ...round.markets.map((market) =>
          prisma.specialRoundResult.upsert({
            create: {
              answer: json(derived.answers[market.id]),
              enteredById: input.actorId,
              marketId: market.id
            },
            update: {
              answer: json(derived.answers[market.id]),
              enteredById: input.actorId
            },
            where: { marketId: market.id }
          })
        ),
        prisma.specialRound.update({
          data: { status: "AWAITING_RESULT" },
          where: { id: round.id }
        }),
        prisma.specialRoundAuditLog.create({
          data: {
            action: input.actorId
              ? "special_round.homologated_from_match_data"
              : "special_round.homologated_automatically",
            actorId: input.actorId,
            entity: "SpecialRound",
            entityId: round.id,
            metadata: json({ markets: round.markets.length, matchId: round.match.id }),
            specialRoundId: round.id
          }
        })
      ],
      serializable
    );

    return { message: "Resultados oficiais homologados.", missing: [], ok: true };
  } catch (error) {
    console.error("Special round homologation failed", {
      error,
      specialRoundId: input.specialRoundId
    });
    return {
      message:
        error instanceof Error && error.message === "MATCH_NOT_LINKED"
          ? "Esta rodada nao esta vinculada a uma partida do catalogo."
          : "Nao foi possivel homologar os dados da partida.",
      ok: false
    };
  }
}

export async function calculateSpecialRound(input: {
  actorId: string | null;
  specialRoundId: string;
}): Promise<SpecialRoundSettlementResult> {
  try {
    await prisma.$transaction(
      async (tx) => {
        const round = await tx.specialRound.findUniqueOrThrow({
          include: {
            entries: {
              include: { predictions: true, standing: true },
              where: { blockedAt: null, paymentStatus: "APPROVED" }
            },
            markets: { include: { result: true }, where: { active: true } }
          },
          where: { id: input.specialRoundId }
        });
        if (!["AWAITING_RESULT", "CALCULATING"].includes(round.status))
          throw new Error("INVALID_STATUS");
        if (round.markets.some((market) => !market.result)) throw new Error("MISSING_RESULTS");
        await tx.specialRound.update({ data: { status: "CALCULATING" }, where: { id: round.id } });
        const candidates = [];
        const scoreRows: {
          entryId: string;
          exactScoreHit: boolean;
          hit: boolean;
          marketId: string;
          maxPointsHit: boolean;
          points: number;
        }[] = [];
        for (const entry of round.entries) {
          let totalPoints = 0,
            hits = 0,
            maxPointsHits = 0,
            exactScoreHits = 0;
          for (const market of round.markets) {
            const prediction = entry.predictions.find((item) => item.marketId === market.id);
            const evaluation = prediction
              ? evaluateSpecialRoundAnswer(
                  {
                    kind: market.kind,
                    line: market.line ? Number(market.line) : null,
                    points: market.points
                  },
                  prediction.answer as SpecialRoundAnswer,
                  market.result!.answer as SpecialRoundAnswer
                )
              : { exactScoreHit: false, hit: false, maxPointsHit: false, points: 0 };
            totalPoints += evaluation.points;
            hits += Number(evaluation.hit);
            maxPointsHits += Number(evaluation.maxPointsHit);
            exactScoreHits += Number(evaluation.exactScoreHit);
            scoreRows.push({ ...evaluation, entryId: entry.id, marketId: market.id });
          }
          candidates.push({
            entryId: entry.id,
            exactScoreHits,
            firstSubmittedAt: entry.predictions.reduce<Date | null>(
              (first, prediction) =>
                !first || prediction.submittedAt < first ? prediction.submittedAt : first,
              null
            ),
            hits,
            manualTieBreak: entry.standing?.manualTieBreak ?? 0,
            maxPointsHits,
            totalPoints
          });
        }
        await tx.specialRoundScore.deleteMany({
          where: { entry: { specialRoundId: round.id } }
        });
        if (scoreRows.length) {
          await tx.specialRoundScore.createMany({ data: scoreRows });
        }
        const ranked = rankSpecialRoundEntries(candidates);
        await tx.specialRoundStanding.deleteMany({ where: { specialRoundId: round.id } });
        if (ranked.length) {
          await tx.specialRoundStanding.createMany({
            data: ranked.map((standing) => ({ ...standing, specialRoundId: round.id }))
          });
        }
        const paidPrize = await tx.specialRoundPrize.findFirst({
          where: { specialRoundId: round.id, status: "PAID" }
        });
        if (paidPrize) throw new Error("PRIZE_ALREADY_PAID");
        await tx.specialRoundPrize.deleteMany({ where: { specialRoundId: round.id } });

        let totalPrize = 0;
        if (round.format === "PROMO_SINGLE_SELECTION") {
          // Promocao nao tem bolo nem ranking: cada aposta certa recebe o proprio retorno
          // (valor apostado * odd). A posicao vem da classificacao so para satisfazer a
          // unicidade de premio por rodada.
          const odds = Number(round.promoOdds ?? 0);
          const stakeByEntry = new Map(
            round.entries.map((entry) => [entry.id, Math.round(Number(entry.amount) * 100)])
          );
          for (const standing of ranked) {
            if (standing.hits < 1) continue;
            const stakeCents = stakeByEntry.get(standing.entryId) ?? 0;
            if (stakeCents <= 0) continue;
            const returnCents = promoReturnCents(stakeCents, odds);
            totalPrize += returnCents / 100;
            await tx.specialRoundPrize.create({
              data: {
                amount: returnCents / 100,
                entryId: standing.entryId,
                percentage: 100,
                position: standing.position,
                specialRoundId: round.id
              }
            });
          }
        } else {
          const paidAmounts = round.entries.map((entry) => Number(entry.amount));
          const pool = calculateSpecialRoundPrizePool({
            adminFeePercent: Number(round.adminFeePercent),
            confirmedAmounts: paidAmounts,
            fixedPrize: round.fixedPrize ? Number(round.fixedPrize) : null,
            mode: round.prizeMode,
            poolPercent: Number(round.prizePoolPercent)
          });
          const distribution = distributeSpecialRoundPrize(
            pool.prize,
            round.prizeDistribution as unknown as PrizeDistributionItem[]
          );
          for (const prize of distribution) {
            const winner = ranked.find((item) => item.position === prize.position);
            if (!winner) continue;
            await tx.specialRoundPrize.create({
              data: { ...prize, entryId: winner.entryId, specialRoundId: round.id }
            });
          }
          totalPrize = pool.prize;
        }

        await tx.specialRound.update({ data: { finalPrize: totalPrize }, where: { id: round.id } });
        await tx.specialRoundAuditLog.create({
          data: {
            action: "special_round.calculated",
            actorId: input.actorId,
            entity: "SpecialRound",
            entityId: round.id,
            metadata: json({ entries: ranked.length, format: round.format, prize: totalPrize }),
            specialRoundId: round.id
          }
        });
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5_000,
        timeout: 20_000
      }
    );
  } catch (error) {
    console.error("Special round calculation failed", {
      error,
      specialRoundId: input.specialRoundId
    });
    return {
      message:
        error instanceof Error && error.message === "MISSING_RESULTS"
          ? "Preencha todos os resultados oficiais antes da apuracao."
          : error instanceof Error && error.message === "PRIZE_ALREADY_PAID"
            ? "Nao e permitido recalcular depois que um premio foi marcado como pago."
            : error instanceof Error && error.message === "INVALID_STATUS"
              ? "A rodada precisa estar aguardando resultado antes da apuracao."
              : "Nao foi possivel calcular a rodada.",
      ok: false
    };
  }
  return { message: "Pontuacao e premiacao recalculadas.", ok: true };
}

export async function finalizeSpecialRound(input: {
  actorId: string | null;
  specialRoundId: string;
}): Promise<SpecialRoundSettlementResult> {
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.specialRound.findUniqueOrThrow({
        where: { id: input.specialRoundId }
      });
      if (current.status === "FINALIZED") return;
      assertSpecialRoundTransition(current.status, "FINALIZED");
      const now = serverNow();
      await tx.specialRound.update({
        data: { finalizedAt: now, rankingPublishedAt: now, status: "FINALIZED" },
        where: { id: current.id }
      });
      await tx.specialRoundAuditLog.create({
        data: {
          action: input.actorId
            ? "special_round.status_changed"
            : "special_round.finalized_automatically",
          actorId: input.actorId,
          entity: "SpecialRound",
          entityId: current.id,
          newValue: json({ status: "FINALIZED" }),
          oldValue: json({ status: current.status }),
          specialRoundId: current.id
        }
      });
      const credited = await creditSpecialRoundPrizesToWallets(tx, {
        format: current.format,
        id: current.id,
        name: current.name,
        promoOdds: current.promoOdds
      });
      if (credited > 0) {
        await tx.specialRoundAuditLog.create({
          data: {
            action: "special_round.prizes_credited_to_wallet",
            actorId: input.actorId,
            entity: "SpecialRound",
            entityId: current.id,
            metadata: json({ prizes: credited }),
            specialRoundId: current.id
          }
        });
      }
      await createSpecialRoundFinalizedNotifications(tx, {
        format: current.format,
        id: current.id,
        name: current.name
      });
    }, serializable);
  } catch (error) {
    console.error("Special round finalization failed", {
      error,
      specialRoundId: input.specialRoundId
    });
    return {
      message:
        error instanceof Error && error.message.startsWith("SPECIAL_ROUND_INVALID_TRANSITION")
          ? "Essa mudanca de status nao e permitida."
          : "Nao foi possivel publicar a classificacao.",
      ok: false
    };
  }
  return { message: "Classificacao publicada.", ok: true };
}

export async function settleSpecialRoundFromCatalog(input: {
  actorId: string | null;
  publish?: boolean;
  specialRoundId: string;
}): Promise<SpecialRoundSettlementResult> {
  const homologation = await homologateSpecialRoundFromCatalog(input);
  if (!homologation.ok) return homologation;

  const calculation = await calculateSpecialRound(input);
  if (!calculation.ok) return { ...calculation, missing: [] };

  if (input.publish === false) {
    return {
      message: "Resultados homologados e classificacao calculada.",
      missing: [],
      ok: true
    };
  }

  const publication = await finalizeSpecialRound(input);
  if (!publication.ok) return { ...publication, missing: [] };

  return {
    message: "Resultados homologados, classificacao calculada e campeao publicado.",
    missing: [],
    ok: true
  };
}

export type AutoSettlementSummary = {
  finalized: number;
  pending: { name: string; reason: string }[];
  scanned: number;
};

// Rodada criada antes de a competicao entrar no catalogo fica sem partida vinculada. Depois
// do apito inicial a partida ja existe no banco, entao vale tentar o vinculo automatico —
// sem isso a rodada nunca entra na varredura e o campeao nunca sai.
const RELINK_AFTER_KICKOFF_MS = 2 * 60 * 60_000;
const RELINK_MAX_AGE_MS = 14 * 24 * 60 * 60_000;

/**
 * Apura e publica automaticamente toda Rodada Especial cuja partida ja terminou.
 * Rodadas sem dados suficientes ficam pendentes e sao tentadas na proxima execucao.
 */
export async function settleFinishedSpecialRounds(
  now = serverNow()
): Promise<AutoSettlementSummary> {
  const rounds = await prisma.specialRound.findMany({
    orderBy: { matchStartsAt: "asc" },
    select: {
      id: true,
      match: { select: { fullySyncedAt: true, kickoff: true, status: true } },
      name: true
    },
    take: 20,
    where: {
      AND: [
        {
          OR: [
            { match: { status: "FINISHED" } },
            {
              matchId: null,
              matchStartsAt: {
                gte: new Date(now.getTime() - RELINK_MAX_AGE_MS),
                lte: new Date(now.getTime() - RELINK_AFTER_KICKOFF_MS)
              }
            }
          ]
        },
        {
          OR: [
            { format: "STANDARD", status: { in: [...settleableSpecialRoundStatuses] } },
            {
              format: "PROMO_SINGLE_SELECTION",
              status: { in: [...settleablePromoRoundStatuses] }
            }
          ]
        }
      ]
    }
  });

  const summary: AutoSettlementSummary = { finalized: 0, pending: [], scanned: rounds.length };

  for (const round of rounds) {
    let match = round.match;

    if (!match) {
      const linked = await resolveApiBackedSpecialRoundMatch(round.id).catch(() => null);
      match = linked
        ? await prisma.match.findUnique({
            select: { fullySyncedAt: true, kickoff: true, status: true },
            where: { id: linked.id }
          })
        : null;
      if (!match) {
        summary.pending.push({
          name: round.name,
          reason: "Partida ainda nao localizada no catalogo da API-Football."
        });
        continue;
      }
    }

    if (
      !isSpecialRoundMatchReadyForSettlement({
        fullySyncedAt: match.fullySyncedAt,
        kickoff: match.kickoff,
        now,
        status: match.status
      })
    ) {
      summary.pending.push({ name: round.name, reason: "Aguardando consolidacao da partida." });
      continue;
    }

    const result = await settleSpecialRoundFromCatalog({
      actorId: null,
      specialRoundId: round.id
    });
    if (result.ok) summary.finalized += 1;
    else summary.pending.push({ name: round.name, reason: result.message });
  }

  return summary;
}
