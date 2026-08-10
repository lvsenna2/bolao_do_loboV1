import type { Prisma, SpecialRoundStatus } from "@prisma/client";

import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";

import type { PrizeDistributionItem, SpecialRoundAnswer } from "../types";
import { deriveCatalogResults } from "./catalog-result-service";
import { calculateSpecialRoundPrizePool, distributeSpecialRoundPrize } from "./prize-service";
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

export async function createSpecialRoundFinalizedNotifications(
  client: Prisma.TransactionClient,
  round: { id: string; name: string }
) {
  const [entries, championName] = await Promise.all([
    client.specialRoundEntry.findMany({
      include: { prize: true },
      where: { paymentStatus: "APPROVED", specialRoundId: round.id }
    }),
    getSpecialRoundChampionName(client, round.id)
  ]);
  const resultBody = championName
    ? `A classificacao de ${round.name} foi publicada. Campeao: ${championName}.`
    : `A classificacao de ${round.name} foi publicada.`;

  await client.notification.createMany({
    data: entries.flatMap((entry) => [
      {
        body: resultBody,
        icon: "special-round-result",
        message: resultBody,
        relatedEntityId: round.id,
        title: "Resultado publicado",
        type: "SPECIAL_ROUND" as const,
        uniqueKey: `special-round:result:${round.id}:${entry.userId}`,
        userId: entry.userId
      },
      ...(entry.prize
        ? [
            {
              body: `Parabens! Voce recebeu uma premiacao em ${round.name}.`,
              icon: "special-round-prize",
              message: `Parabens! Voce recebeu uma premiacao em ${round.name}.`,
              relatedEntityId: entry.prize.id,
              title: "Usuario premiado",
              type: "SPECIAL_ROUND" as const,
              uniqueKey: `special-round:prize:${entry.prize.id}`,
              userId: entry.userId
            }
          ]
        : [])
    ]),
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
        const paidPrize = await tx.specialRoundPrize.findFirst({
          where: { specialRoundId: round.id, status: "PAID" }
        });
        if (paidPrize) throw new Error("PRIZE_ALREADY_PAID");
        await tx.specialRoundPrize.deleteMany({ where: { specialRoundId: round.id } });
        for (const prize of distribution) {
          const winner = ranked.find((item) => item.position === prize.position);
          if (!winner) continue;
          await tx.specialRoundPrize.create({
            data: { ...prize, entryId: winner.entryId, specialRoundId: round.id }
          });
        }
        await tx.specialRound.update({ data: { finalPrize: pool.prize }, where: { id: round.id } });
        await tx.specialRoundAuditLog.create({
          data: {
            action: "special_round.calculated",
            actorId: input.actorId,
            entity: "SpecialRound",
            entityId: round.id,
            metadata: json({ entries: ranked.length, prize: pool.prize }),
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
      await createSpecialRoundFinalizedNotifications(tx, { id: current.id, name: current.name });
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
      match: { status: "FINISHED" },
      status: { in: [...settleableSpecialRoundStatuses] }
    }
  });

  const summary: AutoSettlementSummary = { finalized: 0, pending: [], scanned: rounds.length };

  for (const round of rounds) {
    if (
      !round.match ||
      !isSpecialRoundMatchReadyForSettlement({
        fullySyncedAt: round.match.fullySyncedAt,
        kickoff: round.match.kickoff,
        now,
        status: round.match.status
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
