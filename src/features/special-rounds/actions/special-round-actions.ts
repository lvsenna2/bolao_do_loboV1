"use server";

import type { Prisma, SpecialRoundStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { serverNow } from "@/lib/date-time";
import { requireAdmin, requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getMercadoPagoPayment, refundMercadoPagoPayment } from "@/server/mercado-pago/client";
import { createSpecialRoundPix, reconcileSpecialRoundPayment } from "../services/payment-service";
import {
  calculateSpecialRoundPrizePool,
  distributeSpecialRoundPrize
} from "../services/prize-service";
import { deriveCatalogResults } from "../services/catalog-result-service";
import { buildAutomaticSpecialRoundMarkets } from "../services/default-markets";
import { evaluateSpecialRoundAnswer, rankSpecialRoundEntries } from "../services/scoring-service";
import { assertSpecialRoundTransition, isPredictionWindowOpen } from "../services/state-service";
import {
  automaticSpecialRoundSchema,
  idSchema,
  predictionBatchSchema,
  resultBatchSchema,
  specialRoundMarketSchema,
  specialRoundSchema,
  statusTransitionSchema
} from "../schemas/special-round-schemas";
import type { PrizeDistributionItem, SpecialRoundActionResult, SpecialRoundAnswer } from "../types";

const serializable = { isolationLevel: "Serializable" as const };

function revalidateSpecialRounds(id?: string) {
  revalidatePath("/rodadas-especiais");
  revalidatePath("/rodadas-especiais/historico");
  revalidatePath("/admin/rodadas-especiais");
  revalidatePath("/notificacoes");
  if (id) {
    revalidatePath(`/rodadas-especiais/${id}`);
    revalidatePath(`/admin/rodadas-especiais/${id}`);
  }
}

function fieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}) {
  return Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter((entry): entry is [string, string[]] =>
      Boolean(entry[1]?.length)
    )
  );
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function createSpecialRoundAction(
  input: unknown
): Promise<SpecialRoundActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  const parsed = specialRoundSchema.safeParse(input);
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrors(parsed.error),
      message: "Revise os dados da rodada.",
      ok: false
    };
  }
  const value = parsed.data;
  const round = await prisma.$transaction(async (tx) => {
    const created = await tx.specialRound.create({
      data: {
        ...value,
        awayTeamLogo: value.awayTeamLogo || null,
        description: value.description || null,
        fixedPrize: value.fixedPrize ?? null,
        homeTeamLogo: value.homeTeamLogo || null,
        matchId: value.matchId || null,
        prizeDistribution: json(value.prizeDistribution),
        rules: value.rules || null,
        createdById: admin.id
      },
      select: { id: true, name: true }
    });
    await tx.specialRoundAuditLog.create({
      data: {
        action: "special_round.created",
        actorId: admin.id,
        entity: "SpecialRound",
        entityId: created.id,
        newValue: json(created),
        specialRoundId: created.id
      }
    });
    return created;
  }, serializable);
  revalidateSpecialRounds(round.id);
  return { data: { id: round.id }, message: "Rodada especial criada.", ok: true };
}

export async function createAutomaticSpecialRoundAction(
  input: unknown
): Promise<SpecialRoundActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  const parsed = automaticSpecialRoundSchema.safeParse(input);
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrors(parsed.error),
      message: "Selecione uma partida e informe um valor de inscricao valido.",
      ok: false
    };
  }

  try {
    const round = await prisma.$transaction(async (tx) => {
      const match = await tx.match.findFirst({
        include: {
          awayTeam: true,
          homeTeam: true,
          lineups: {
            include: {
              players: { include: { player: true } }
            }
          },
          playerStatistics: { include: { player: true } },
          round: {
            include: {
              season: { include: { championship: true } }
            }
          }
        },
        where: { deletedAt: null, id: parsed.data.matchId }
      });
      if (!match) throw new Error("MATCH_NOT_FOUND");

      const now = serverNow();
      if (match.kickoff <= now || ["FINISHED", "CANCELLED"].includes(match.status)) {
        throw new Error("MATCH_ALREADY_STARTED");
      }

      const existing = await tx.specialRound.findFirst({
        select: { id: true },
        where: { matchId: match.id, status: { not: "CANCELLED" } }
      });
      if (existing) return existing;

      const players = [
        ...match.lineups.flatMap((lineup) =>
          lineup.players.map((item) => ({ id: item.player.id, name: item.player.name }))
        ),
        ...match.playerStatistics.map((item) => ({
          id: item.player.id,
          name: item.player.name
        }))
      ];
      const markets = buildAutomaticSpecialRoundMarkets(
        match.homeTeam.name,
        match.awayTeam.name,
        players
      );
      const championship = match.round.season.championship.name;
      const created = await tx.specialRound.create({
        data: {
          adminFeePercent: 10,
          awayTeamLogo: match.awayTeam.logo,
          awayTeamName: match.awayTeam.name,
          createdById: admin.id,
          description: `${championship}: ${match.homeTeam.name} x ${match.awayTeam.name}.`,
          entryFee: parsed.data.entryFee,
          homeTeamLogo: match.homeTeam.logo,
          homeTeamName: match.homeTeam.name,
          matchId: match.id,
          matchStartsAt: match.kickoff,
          name: `${match.homeTeam.name} x ${match.awayTeam.name} - Rodada Especial`,
          predictionsCloseAt: match.kickoff,
          predictionsOpenAt: now,
          prizeDistribution: json([{ percent: 100, position: 1 }]),
          prizeMode: "POOL",
          prizePoolPercent: 90,
          registrationClosesAt: match.kickoff,
          registrationOpensAt: now,
          rules:
            "Uma inscricao por participante. Os oito mercados sao apurados com os dados oficiais da partida catalogada. Em caso de empate, valem os criterios publicados da Rodada Especial.",
          status: "PREDICTIONS_OPEN",
          winnerCount: 1,
          markets: {
            create: markets.map((market) => ({
              active: market.active,
              answerType: market.answerType,
              description: market.description,
              kind: market.kind,
              line: market.line,
              options: {
                create: market.options.map((option, index) => ({
                  ...option,
                  sortOrder: index
                }))
              },
              points: market.points,
              required: market.required,
              sortOrder: market.sortOrder,
              title: market.title
            }))
          }
        },
        select: { id: true, name: true }
      });

      await tx.specialRoundAuditLog.create({
        data: {
          action: "special_round.created_from_catalog",
          actorId: admin.id,
          entity: "SpecialRound",
          entityId: created.id,
          metadata: json({ matchId: match.id, markets: markets.length }),
          specialRoundId: created.id
        }
      });
      const users = await tx.user.findMany({
        select: { id: true },
        where: { deletedAt: null, status: "ACTIVE" }
      });
      await tx.notification.createMany({
        data: users.map((user) => ({
          body: `${created.name} esta aberta para inscricoes e palpites.`,
          icon: "special-round",
          message: `${created.name} esta aberta para inscricoes e palpites.`,
          relatedEntityId: created.id,
          title: "Nova rodada especial",
          type: "SPECIAL_ROUND" as const,
          uniqueKey: `special-round:opened:${created.id}:${user.id}`,
          userId: user.id
        })),
        skipDuplicates: true
      });
      return created;
    }, serializable);

    revalidateSpecialRounds(round.id);
    return {
      data: { id: round.id },
      message: "Rodada aberta com os oito mercados automaticos.",
      ok: true
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message === "MATCH_ALREADY_STARTED"
        ? "Escolha uma partida que ainda nao comecou."
        : error instanceof Error && error.message === "MATCH_NOT_FOUND"
          ? "A partida nao foi encontrada no catalogo."
          : "Nao foi possivel criar a rodada automaticamente.";
    return { message, ok: false };
  }
}

export async function updateSpecialRoundAction(
  specialRoundId: string,
  input: unknown
): Promise<SpecialRoundActionResult> {
  const admin = await requireAdmin();
  const [id, parsed] = [idSchema.safeParse(specialRoundId), specialRoundSchema.safeParse(input)];
  if (!id.success || !parsed.success) {
    return {
      fieldErrors: parsed.success ? undefined : fieldErrors(parsed.error),
      message: "Revise os dados da rodada.",
      ok: false
    };
  }
  const current = await prisma.specialRound.findUnique({ where: { id: id.data } });
  if (!current || !["DRAFT", "REGISTRATION_OPEN"].includes(current.status)) {
    return { message: "A rodada nao pode mais ser editada.", ok: false };
  }
  const value = parsed.data;
  await prisma.$transaction(async (tx) => {
    await tx.specialRound.update({
      data: {
        ...value,
        awayTeamLogo: value.awayTeamLogo || null,
        description: value.description || null,
        fixedPrize: value.fixedPrize ?? null,
        homeTeamLogo: value.homeTeamLogo || null,
        matchId: value.matchId || null,
        prizeDistribution: json(value.prizeDistribution),
        rules: value.rules || null
      },
      where: { id: id.data }
    });
    await tx.specialRoundAuditLog.create({
      data: {
        action: "special_round.updated",
        actorId: admin.id,
        entity: "SpecialRound",
        entityId: id.data,
        newValue: json(value),
        specialRoundId: id.data
      }
    });
  }, serializable);
  revalidateSpecialRounds(id.data);
  return { message: "Rodada atualizada.", ok: true };
}

export async function duplicateSpecialRoundAction(
  specialRoundId: string
): Promise<SpecialRoundActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(specialRoundId);
  if (!id.success) return { message: "Rodada invalida.", ok: false };
  const source = await prisma.specialRound.findUnique({
    include: { markets: { include: { options: true } } },
    where: { id: id.data }
  });
  if (!source) return { message: "Rodada nao encontrada.", ok: false };
  const created = await prisma.$transaction(async (tx) => {
    const round = await tx.specialRound.create({
      data: {
        adminFeePercent: source.adminFeePercent,
        awayTeamLogo: source.awayTeamLogo,
        awayTeamName: source.awayTeamName,
        createdById: admin.id,
        description: source.description,
        entryFee: source.entryFee,
        fixedPrize: source.fixedPrize,
        homeTeamLogo: source.homeTeamLogo,
        homeTeamName: source.homeTeamName,
        matchId: source.matchId,
        matchStartsAt: source.matchStartsAt,
        name: `${source.name} - copia`,
        predictionsCloseAt: source.predictionsCloseAt,
        predictionsOpenAt: source.predictionsOpenAt,
        prizeDistribution: source.prizeDistribution as Prisma.InputJsonValue,
        prizeMode: source.prizeMode,
        prizePoolPercent: source.prizePoolPercent,
        registrationClosesAt: source.registrationClosesAt,
        registrationOpensAt: source.registrationOpensAt,
        rules: source.rules,
        status: "DRAFT",
        winnerCount: source.winnerCount
      }
    });
    for (const market of source.markets) {
      await tx.specialRoundMarket.create({
        data: {
          active: market.active,
          answerType: market.answerType,
          description: market.description,
          kind: market.kind,
          line: market.line,
          options: {
            create: market.options.map((option) => ({
              active: option.active,
              label: option.label,
              sortOrder: option.sortOrder,
              value: option.value
            }))
          },
          points: market.points,
          required: market.required,
          sortOrder: market.sortOrder,
          specialRoundId: round.id,
          title: market.title
        }
      });
    }
    return round;
  }, serializable);
  revalidateSpecialRounds(created.id);
  return { data: { id: created.id }, message: "Copia criada como rascunho.", ok: true };
}

export async function updateSpecialRoundStatusAction(
  input: unknown
): Promise<SpecialRoundActionResult> {
  const admin = await requireAdmin();
  const parsed = statusTransitionSchema.safeParse(input);
  if (!parsed.success) return { message: "Status invalido.", ok: false };
  const { specialRoundId, status } = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.specialRound.findUniqueOrThrow({ where: { id: specialRoundId } });
      assertSpecialRoundTransition(current.status, status);
      const now = serverNow();
      await tx.specialRound.update({
        data: {
          cancelledAt: status === "CANCELLED" ? now : undefined,
          finalizedAt: status === "FINALIZED" ? now : undefined,
          rankingPublishedAt: status === "FINALIZED" ? now : undefined,
          status
        },
        where: { id: specialRoundId }
      });
      await tx.specialRoundAuditLog.create({
        data: {
          action: "special_round.status_changed",
          actorId: admin.id,
          entity: "SpecialRound",
          entityId: specialRoundId,
          newValue: json({ status }),
          oldValue: json({ status: current.status }),
          specialRoundId
        }
      });
      if (status === "REGISTRATION_OPEN") {
        const users = await tx.user.findMany({
          select: { id: true },
          where: { deletedAt: null, status: "ACTIVE" }
        });
        await tx.notification.createMany({
          data: users.map((user) => ({
            body: `${current.name} esta com inscricoes abertas.`,
            icon: "special-round",
            message: `${current.name} esta com inscricoes abertas.`,
            relatedEntityId: specialRoundId,
            title: "Nova rodada especial",
            type: "SPECIAL_ROUND" as const,
            uniqueKey: `special-round:opened:${specialRoundId}:${user.id}`,
            userId: user.id
          })),
          skipDuplicates: true
        });
      }
      if (status === "PREDICTIONS_OPEN") {
        const entries = await tx.specialRoundEntry.findMany({
          select: { id: true, userId: true },
          where: { blockedAt: null, paymentStatus: "APPROVED", specialRoundId }
        });
        await tx.notification.createMany({
          data: entries.map((entry) => ({
            body: `Os palpites de ${current.name} estao liberados.`,
            icon: "special-round-predictions",
            message: `Os palpites de ${current.name} estao liberados.`,
            relatedEntityId: specialRoundId,
            title: "Palpites liberados",
            type: "SPECIAL_ROUND" as const,
            uniqueKey: `special-round:predictions-open:${specialRoundId}:${entry.userId}`,
            userId: entry.userId
          })),
          skipDuplicates: true
        });
      }
      if (status === "FINALIZED") {
        const entries = await tx.specialRoundEntry.findMany({
          include: { prize: true },
          where: { paymentStatus: "APPROVED", specialRoundId }
        });
        await tx.notification.createMany({
          data: entries.flatMap((entry) => [
            {
              body: `A classificacao de ${current.name} foi publicada.`,
              icon: "special-round-result",
              message: `A classificacao de ${current.name} foi publicada.`,
              relatedEntityId: specialRoundId,
              title: "Resultado publicado",
              type: "SPECIAL_ROUND" as const,
              uniqueKey: `special-round:result:${specialRoundId}:${entry.userId}`,
              userId: entry.userId
            },
            ...(entry.prize
              ? [
                  {
                    body: `Parabens! Voce recebeu uma premiacao em ${current.name}.`,
                    icon: "special-round-prize",
                    message: `Parabens! Voce recebeu uma premiacao em ${current.name}.`,
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
      if (status === "CANCELLED") {
        const entries = await tx.specialRoundEntry.findMany({
          select: { id: true, userId: true },
          where: { specialRoundId }
        });
        await tx.notification.createMany({
          data: entries.map((entry) => ({
            body: `${current.name} foi cancelada. Pagamentos aprovados devem ser reembolsados pelo administrador.`,
            icon: "special-round-cancelled",
            message: `${current.name} foi cancelada. Pagamentos aprovados devem ser reembolsados pelo administrador.`,
            relatedEntityId: specialRoundId,
            title: "Rodada cancelada",
            type: "SPECIAL_ROUND" as const,
            uniqueKey: `special-round:cancelled:${specialRoundId}:${entry.userId}`,
            userId: entry.userId
          })),
          skipDuplicates: true
        });
      }
    }, serializable);
  } catch (error) {
    return {
      message:
        error instanceof Error && error.message.startsWith("SPECIAL_ROUND_INVALID_TRANSITION")
          ? "Essa mudanca de status nao e permitida."
          : "Nao foi possivel atualizar o status.",
      ok: false
    };
  }
  revalidateSpecialRounds(specialRoundId);
  return { message: "Status atualizado.", ok: true };
}

export async function joinSpecialRoundAction(
  specialRoundId: string
): Promise<SpecialRoundActionResult<Record<string, unknown>>> {
  const user = await requireUser();
  const id = idSchema.safeParse(specialRoundId);
  if (!id.success) return { message: "Rodada invalida.", ok: false };
  const now = serverNow();
  const round = await prisma.specialRound.findUnique({ where: { id: id.data } });
  if (
    !round ||
    !["REGISTRATION_OPEN", "PREDICTIONS_OPEN"].includes(round.status) ||
    now < round.registrationOpensAt ||
    now >= round.registrationClosesAt
  ) {
    return { message: "As inscricoes nao estao abertas.", ok: false };
  }
  const payer = await prisma.user.findUnique({ select: { email: true }, where: { id: user.id } });
  if (!payer) return { message: "Usuario nao encontrado.", ok: false };

  const entry = await prisma.$transaction(async (tx) => {
    const existing = await tx.specialRoundEntry.findUnique({
      where: { specialRoundId_userId: { specialRoundId: round.id, userId: user.id } }
    });
    if (existing) return existing;
    const created = await tx.specialRoundEntry.create({
      data: {
        amount: round.entryFee,
        checkoutKey: `special-round:${round.id}:user:${user.id}`,
        paymentStatus: Number(round.entryFee) === 0 ? "APPROVED" : "PENDING",
        confirmedAt: Number(round.entryFee) === 0 ? now : null,
        specialRoundId: round.id,
        userId: user.id
      }
    });
    await tx.specialRoundAuditLog.create({
      data: {
        action: "special_round.entry_created",
        actorId: user.id,
        entity: "SpecialRoundEntry",
        entityId: created.id,
        newValue: json({ amount: created.amount, paymentStatus: created.paymentStatus }),
        specialRoundId: round.id
      }
    });
    return created;
  }, serializable);

  if (entry.paymentStatus === "APPROVED") {
    revalidateSpecialRounds(round.id);
    return { message: "Participacao liberada.", ok: true };
  }
  if (entry.qrCode && entry.qrCodeBase64 && entry.transactionId) {
    return {
      data: {
        amountLabel: new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" }).format(
          Number(entry.amount)
        ),
        paymentId: entry.id,
        pixCode: entry.qrCode,
        qrCodeDataUri: `data:image/png;base64,${entry.qrCodeBase64}`,
        ticketUrl: entry.ticketUrl,
        transactionId: entry.transactionId
      },
      message: "Pagamento pendente.",
      ok: true
    };
  }
  try {
    const payment = await createSpecialRoundPix({
      entryId: entry.id,
      payerEmail: payer.email,
      roundName: round.name
    });
    revalidateSpecialRounds(round.id);
    return {
      data: payment,
      message: "PIX gerado. A participacao sera liberada apos a confirmacao.",
      ok: true
    };
  } catch (error) {
    console.error("Special round PIX creation failed", { entryId: entry.id, error });
    return { message: "Nao foi possivel gerar o PIX. Tente novamente.", ok: false };
  }
}

export async function checkSpecialRoundPaymentAction(
  entryId: string
): Promise<SpecialRoundActionResult<{ status: string }>> {
  const user = await requireUser();
  const entry = await prisma.specialRoundEntry.findFirst({
    where: { id: entryId, userId: user.id }
  });
  if (!entry) return { message: "Inscricao nao encontrada.", ok: false };
  if (entry.paymentStatus !== "PENDING" || !entry.transactionId) {
    return { data: { status: entry.paymentStatus }, message: "Status consultado.", ok: true };
  }
  try {
    const provider = await getMercadoPagoPayment(entry.transactionId);
    const result = await reconcileSpecialRoundPayment(provider);
    revalidateSpecialRounds(entry.specialRoundId);
    return { data: { status: result.status }, message: "Status atualizado.", ok: true };
  } catch {
    return { message: "Ainda nao foi possivel confirmar o pagamento.", ok: false };
  }
}

export async function submitSpecialRoundPredictionsAction(
  input: unknown
): Promise<SpecialRoundActionResult> {
  const user = await requireUser();
  const parsed = predictionBatchSchema.safeParse(input);
  if (!parsed.success)
    return { fieldErrors: fieldErrors(parsed.error), message: "Revise os palpites.", ok: false };
  const now = serverNow();
  try {
    await prisma.$transaction(async (tx) => {
      const entry = await tx.specialRoundEntry.findUnique({
        include: { specialRound: true },
        where: {
          specialRoundId_userId: { specialRoundId: parsed.data.specialRoundId, userId: user.id }
        }
      });
      if (!entry || entry.paymentStatus !== "APPROVED" || entry.blockedAt) {
        throw new Error("SPECIAL_ROUND_ENTRY_NOT_ALLOWED");
      }
      if (
        !isPredictionWindowOpen({
          closesAt: entry.specialRound.predictionsCloseAt,
          matchStartsAt: entry.specialRound.matchStartsAt,
          now,
          opensAt: entry.specialRound.predictionsOpenAt,
          status: entry.specialRound.status
        })
      )
        throw new Error("SPECIAL_ROUND_PREDICTIONS_CLOSED");
      const allMarkets = await tx.specialRoundMarket.findMany({
        include: { options: { where: { active: true } } },
        where: { active: true, specialRoundId: entry.specialRoundId }
      });
      const markets = allMarkets.filter((market) => market.id in parsed.data.answers);
      if (markets.length !== Object.keys(parsed.data.answers).length)
        throw new Error("SPECIAL_ROUND_INVALID_MARKET");
      if (allMarkets.some((market) => market.required && !(market.id in parsed.data.answers))) {
        throw new Error("SPECIAL_ROUND_REQUIRED_MARKET");
      }
      for (const market of markets) {
        const answer = parsed.data.answers[market.id];
        const valid =
          (market.answerType === "SCORE" &&
            typeof answer === "object" &&
            Number.isInteger(answer.home) &&
            Number.isInteger(answer.away)) ||
          (market.answerType === "INTEGER" && Number.isInteger(answer)) ||
          (market.answerType === "BOOLEAN" && typeof answer === "boolean") ||
          (["SINGLE_CHOICE", "OPTION_LIST"].includes(market.answerType) &&
            typeof answer === "string" &&
            market.options.some((option) => option.value === answer)) ||
          (market.answerType === "SHORT_TEXT" &&
            typeof answer === "string" &&
            answer.trim().length > 0 &&
            answer.length <= 120);
        if (!valid) throw new Error("SPECIAL_ROUND_INVALID_ANSWER");
        await tx.specialRoundPrediction.upsert({
          create: {
            answer: json(answer),
            entryId: entry.id,
            marketId: market.id,
            submittedAt: now,
            userId: user.id
          },
          update: { answer: json(answer) },
          where: { entryId_marketId: { entryId: entry.id, marketId: market.id } }
        });
      }
    }, serializable);
  } catch (error) {
    const message =
      error instanceof Error && error.message === "SPECIAL_ROUND_PREDICTIONS_CLOSED"
        ? "O prazo para palpites foi encerrado."
        : "Nao foi possivel salvar os palpites.";
    return { message, ok: false };
  }
  revalidateSpecialRounds(parsed.data.specialRoundId);
  return { message: "Palpites salvos.", ok: true };
}

export async function createSpecialRoundMarketAction(
  input: unknown
): Promise<SpecialRoundActionResult> {
  const admin = await requireAdmin();
  const parsed = specialRoundMarketSchema.safeParse(input);
  if (!parsed.success)
    return { fieldErrors: fieldErrors(parsed.error), message: "Revise o mercado.", ok: false };
  const value = parsed.data;
  const defaultOptions: Partial<
    Record<(typeof value)["kind"], { label: string; value: string }[]>
  > = {
    FIRST_TEAM_TO_SCORE: [
      { label: "Casa", value: "HOME" },
      { label: "Visitante", value: "AWAY" },
      { label: "Sem gols", value: "NO_GOAL" }
    ],
    MATCH_RESULT: [
      { label: "Casa", value: "HOME" },
      { label: "Empate", value: "DRAW" },
      { label: "Visitante", value: "AWAY" }
    ],
    TOTAL_CARDS: [
      { label: "Acima", value: "OVER" },
      { label: "Abaixo", value: "UNDER" }
    ],
    TOTAL_CORNERS: [
      { label: "Acima", value: "OVER" },
      { label: "Abaixo", value: "UNDER" }
    ],
    TOTAL_GOALS: [
      { label: "Acima", value: "OVER" },
      { label: "Abaixo", value: "UNDER" }
    ]
  };
  const options = value.options.length ? value.options : (defaultOptions[value.kind] ?? []);
  const round = await prisma.specialRound.findUnique({
    select: { status: true },
    where: { id: value.specialRoundId }
  });
  if (!round || !["DRAFT", "REGISTRATION_OPEN"].includes(round.status)) {
    return { message: "Mercados so podem ser alterados antes dos palpites.", ok: false };
  }
  const market = await prisma.$transaction(async (tx) => {
    const created = await tx.specialRoundMarket.create({
      data: {
        active: value.active,
        answerType: value.answerType,
        description: value.description || null,
        kind: value.kind,
        line: value.line ?? null,
        points: value.points,
        required: value.required,
        sortOrder: value.sortOrder,
        specialRoundId: value.specialRoundId,
        title: value.title,
        options: { create: options.map((option, index) => ({ ...option, sortOrder: index })) }
      }
    });
    await tx.specialRoundAuditLog.create({
      data: {
        action: "special_round.market_created",
        actorId: admin.id,
        entity: "SpecialRoundMarket",
        entityId: created.id,
        newValue: json(value),
        specialRoundId: value.specialRoundId
      }
    });
    return created;
  }, serializable);
  revalidateSpecialRounds(value.specialRoundId);
  return { message: `Mercado ${market.title} criado.`, ok: true };
}

export async function saveSpecialRoundResultsAction(
  input: unknown
): Promise<SpecialRoundActionResult> {
  const admin = await requireAdmin();
  const parsed = resultBatchSchema.safeParse(input);
  if (!parsed.success) return { message: "Resultados invalidos.", ok: false };
  try {
    await prisma.$transaction(async (tx) => {
      const markets = await tx.specialRoundMarket.findMany({
        where: {
          id: { in: Object.keys(parsed.data.answers) },
          specialRoundId: parsed.data.specialRoundId
        }
      });
      if (markets.length !== Object.keys(parsed.data.answers).length)
        throw new Error("INVALID_MARKET");
      for (const market of markets) {
        const answer = parsed.data.answers[market.id];
        const valid =
          (market.kind === "EXACT_SCORE" &&
            typeof answer === "object" &&
            Number.isInteger(answer.home) &&
            Number.isInteger(answer.away)) ||
          (["TOTAL_GOALS", "TOTAL_CORNERS", "TOTAL_CARDS"].includes(market.kind) &&
            typeof answer === "number" &&
            Number.isFinite(answer) &&
            answer >= 0) ||
          (market.kind === "BOTH_TEAMS_SCORE" && typeof answer === "boolean") ||
          (![
            "EXACT_SCORE",
            "TOTAL_GOALS",
            "TOTAL_CORNERS",
            "TOTAL_CARDS",
            "BOTH_TEAMS_SCORE"
          ].includes(market.kind) &&
            typeof answer === "string" &&
            answer.trim().length > 0);
        if (!valid) throw new Error("INVALID_RESULT");
        await tx.specialRoundResult.upsert({
          create: {
            answer: json(answer),
            enteredById: admin.id,
            marketId: market.id
          },
          update: { answer: json(answer), enteredById: admin.id },
          where: { marketId: market.id }
        });
      }
      const round = await tx.specialRound.findUniqueOrThrow({
        where: { id: parsed.data.specialRoundId }
      });
      if (round.status === "PREDICTIONS_CLOSED") {
        await tx.specialRound.update({
          data: { status: "AWAITING_RESULT" },
          where: { id: round.id }
        });
      }
    }, serializable);
  } catch {
    return { message: "Revise os resultados oficiais informados.", ok: false };
  }
  revalidateSpecialRounds(parsed.data.specialRoundId);
  return { message: "Resultados oficiais salvos.", ok: true };
}

export async function homologateSpecialRoundFromCatalogAction(
  specialRoundId: string
): Promise<SpecialRoundActionResult<{ missing: string[] }>> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(specialRoundId);
  if (!id.success) return { message: "Rodada invalida.", ok: false };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const round = await tx.specialRound.findUnique({
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
              statistics: { select: { type: true, value: true } }
            }
          }
        },
        where: { id: id.data }
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
        return { missing: derived.missing, saved: false };
      }

      for (const market of round.markets) {
        const answer = derived.answers[market.id];
        await tx.specialRoundResult.upsert({
          create: { answer: json(answer), enteredById: admin.id, marketId: market.id },
          update: { answer: json(answer), enteredById: admin.id },
          where: { marketId: market.id }
        });
      }
      await tx.specialRound.update({
        data: { status: "AWAITING_RESULT" },
        where: { id: round.id }
      });
      await tx.specialRoundAuditLog.create({
        data: {
          action: "special_round.homologated_from_catalog",
          actorId: admin.id,
          entity: "SpecialRound",
          entityId: round.id,
          metadata: json({ matchId: round.match.id, markets: round.markets.length }),
          specialRoundId: round.id
        }
      });
      return { missing: [], saved: true };
    }, serializable);

    if (!result.saved) {
      return {
        data: { missing: result.missing },
        message: `O catalogo ainda nao possui: ${result.missing.join(", ")}.`,
        ok: false
      };
    }

    const calculation = await calculateSpecialRoundAction(id.data);
    if (!calculation.ok) {
      return { data: { missing: [] }, message: calculation.message, ok: false };
    }
    revalidateSpecialRounds(id.data);
    return {
      data: { missing: [] },
      message: "Resultados homologados e classificacao calculada.",
      ok: true
    };
  } catch (error) {
    return {
      message:
        error instanceof Error && error.message === "MATCH_NOT_LINKED"
          ? "Esta rodada nao esta vinculada a uma partida do catalogo."
          : "Nao foi possivel homologar os dados da partida.",
      ok: false
    };
  }
}

export async function calculateSpecialRoundAction(
  specialRoundId: string
): Promise<SpecialRoundActionResult> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(specialRoundId);
  if (!id.success) return { message: "Rodada invalida.", ok: false };
  try {
    await prisma.$transaction(async (tx) => {
      const round = await tx.specialRound.findUniqueOrThrow({
        include: {
          entries: {
            include: { predictions: true, standing: true },
            where: { blockedAt: null, paymentStatus: "APPROVED" }
          },
          markets: { include: { result: true }, where: { active: true } }
        },
        where: { id: id.data }
      });
      if (!["AWAITING_RESULT", "CALCULATING"].includes(round.status))
        throw new Error("INVALID_STATUS");
      if (round.markets.some((market) => !market.result)) throw new Error("MISSING_RESULTS");
      await tx.specialRound.update({ data: { status: "CALCULATING" }, where: { id: round.id } });
      const candidates = [];
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
          await tx.specialRoundScore.upsert({
            create: { ...evaluation, entryId: entry.id, marketId: market.id },
            update: { ...evaluation, calculatedAt: serverNow() },
            where: { entryId_marketId: { entryId: entry.id, marketId: market.id } }
          });
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
      const ranked = rankSpecialRoundEntries(candidates);
      await tx.specialRoundStanding.updateMany({
        data: { position: null },
        where: { specialRoundId: round.id }
      });
      for (const standing of ranked) {
        await tx.specialRoundStanding.upsert({
          create: { ...standing, specialRoundId: round.id },
          update: standing,
          where: { entryId: standing.entryId }
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
          actorId: admin.id,
          entity: "SpecialRound",
          entityId: round.id,
          metadata: json({ entries: ranked.length, prize: pool.prize }),
          specialRoundId: round.id
        }
      });
    }, serializable);
  } catch (error) {
    return {
      message:
        error instanceof Error && error.message === "MISSING_RESULTS"
          ? "Preencha todos os resultados oficiais antes da apuracao."
          : error instanceof Error && error.message === "PRIZE_ALREADY_PAID"
            ? "Nao e permitido recalcular depois que um premio foi marcado como pago."
            : "Nao foi possivel calcular a rodada.",
      ok: false
    };
  }
  revalidateSpecialRounds(id.data);
  return { message: "Pontuacao e premiacao recalculadas.", ok: true };
}

export async function confirmSpecialRoundEntryAction(
  entryId: string
): Promise<SpecialRoundActionResult> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(entryId);
  if (!parsed.success) return { message: "Inscricao invalida.", ok: false };
  const entry = await prisma.specialRoundEntry.findUnique({ where: { id: parsed.data } });
  if (!entry) return { message: "Inscricao nao encontrada.", ok: false };
  const now = serverNow();
  await prisma.$transaction(async (tx) => {
    await tx.specialRoundEntry.update({
      data: { confirmedAt: now, paymentStatus: "APPROVED" },
      where: { id: entry.id }
    });
    await tx.specialRoundAuditLog.create({
      data: {
        action: "special_round.entry_manually_approved",
        actorId: admin.id,
        entity: "SpecialRoundEntry",
        entityId: entry.id,
        specialRoundId: entry.specialRoundId
      }
    });
  }, serializable);
  revalidateSpecialRounds(entry.specialRoundId);
  return { message: "Inscricao confirmada.", ok: true };
}

export async function toggleSpecialRoundEntryBlockAction(
  entryId: string,
  blocked: boolean
): Promise<SpecialRoundActionResult> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(entryId);
  if (!id.success) return { message: "Inscricao invalida.", ok: false };
  const entry = await prisma.specialRoundEntry.findUnique({ where: { id: id.data } });
  if (!entry) return { message: "Inscricao nao encontrada.", ok: false };
  await prisma.$transaction(async (tx) => {
    await tx.specialRoundEntry.update({
      data: {
        blockedAt: blocked ? serverNow() : null,
        blockedReason: blocked ? "Bloqueio administrativo" : null
      },
      where: { id: entry.id }
    });
    await tx.specialRoundAuditLog.create({
      data: {
        action: blocked ? "special_round.entry_blocked" : "special_round.entry_unblocked",
        actorId: admin.id,
        entity: "SpecialRoundEntry",
        entityId: entry.id,
        specialRoundId: entry.specialRoundId
      }
    });
  }, serializable);
  revalidateSpecialRounds(entry.specialRoundId);
  return { message: blocked ? "Participante bloqueado." : "Participante liberado.", ok: true };
}

export async function refundSpecialRoundEntryAction(
  entryId: string
): Promise<SpecialRoundActionResult> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(entryId);
  if (!id.success) return { message: "Inscricao invalida.", ok: false };
  const entry = await prisma.specialRoundEntry.findUnique({
    include: { specialRound: { select: { name: true } } },
    where: { id: id.data }
  });
  if (!entry || entry.paymentStatus !== "APPROVED" || !entry.transactionId) {
    return { message: "Este pagamento nao pode ser reembolsado automaticamente.", ok: false };
  }
  try {
    await refundMercadoPagoPayment(entry.transactionId, `${entry.id}:refund`);
    const now = serverNow();
    await prisma.$transaction(async (tx) => {
      await tx.specialRoundEntry.update({
        data: { paymentStatus: "REFUNDED", refundedAt: now },
        where: { id: entry.id }
      });
      await tx.notification.upsert({
        create: {
          body: `O pagamento de ${entry.specialRound.name} foi reembolsado.`,
          icon: "special-round-refund",
          message: `O pagamento de ${entry.specialRound.name} foi reembolsado.`,
          relatedEntityId: entry.id,
          title: "Reembolso efetuado",
          type: "SPECIAL_ROUND",
          uniqueKey: `special-round:refund:${entry.id}`,
          userId: entry.userId
        },
        update: {},
        where: { uniqueKey: `special-round:refund:${entry.id}` }
      });
      await tx.specialRoundAuditLog.create({
        data: {
          action: "special_round.entry_refunded",
          actorId: admin.id,
          entity: "SpecialRoundEntry",
          entityId: entry.id,
          specialRoundId: entry.specialRoundId
        }
      });
    }, serializable);
  } catch (error) {
    console.error("Special round refund failed", { entryId: entry.id, error });
    return { message: "O Mercado Pago nao confirmou o reembolso.", ok: false };
  }
  revalidateSpecialRounds(entry.specialRoundId);
  return { message: "Reembolso confirmado.", ok: true };
}

export async function updateSpecialRoundTieBreakAction(
  entryId: string,
  manualTieBreak: number
): Promise<SpecialRoundActionResult> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(entryId);
  if (!id.success || !Number.isInteger(manualTieBreak))
    return { message: "Criterio invalido.", ok: false };
  const standing = await prisma.specialRoundStanding.findUnique({ where: { entryId: id.data } });
  if (!standing) return { message: "Classificacao ainda nao calculada.", ok: false };
  await prisma.$transaction(async (tx) => {
    await tx.specialRoundStanding.update({ data: { manualTieBreak }, where: { entryId: id.data } });
    await tx.specialRoundAuditLog.create({
      data: {
        action: "special_round.manual_tiebreak",
        actorId: admin.id,
        entity: "SpecialRoundStanding",
        entityId: standing.id,
        newValue: json({ manualTieBreak }),
        oldValue: json({ manualTieBreak: standing.manualTieBreak }),
        specialRoundId: standing.specialRoundId
      }
    });
  }, serializable);
  revalidateSpecialRounds(standing.specialRoundId);
  return { message: "Criterio manual salvo. Recalcule a rodada.", ok: true };
}

export async function markSpecialRoundPrizePaidAction(
  prizeId: string
): Promise<SpecialRoundActionResult> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(prizeId);
  if (!id.success) return { message: "Premio invalido.", ok: false };
  const prize = await prisma.specialRoundPrize.findUnique({ where: { id: id.data } });
  if (!prize) return { message: "Premio nao encontrado.", ok: false };
  await prisma.$transaction(async (tx) => {
    await tx.specialRoundPrize.update({
      data: { confirmedAt: prize.confirmedAt ?? serverNow(), paidAt: serverNow(), status: "PAID" },
      where: { id: prize.id }
    });
    await tx.specialRoundAuditLog.create({
      data: {
        action: "special_round.prize_paid",
        actorId: admin.id,
        entity: "SpecialRoundPrize",
        entityId: prize.id,
        specialRoundId: prize.specialRoundId
      }
    });
  }, serializable);
  revalidateSpecialRounds(prize.specialRoundId);
  return { message: "Premio marcado como pago.", ok: true };
}

export async function deleteSpecialRoundAction(
  specialRoundId: string
): Promise<SpecialRoundActionResult> {
  await requireAdmin();
  const id = idSchema.safeParse(specialRoundId);
  if (!id.success) return { message: "Rodada invalida.", ok: false };
  const round = await prisma.specialRound.findUnique({
    include: { _count: { select: { entries: true } } },
    where: { id: id.data }
  });
  if (!round || round._count.entries > 0) {
    return {
      message:
        "Rodadas com inscricoes nao podem ser excluidas. Cancele a rodada para preservar pagamentos e auditoria.",
      ok: false
    };
  }
  await prisma.$transaction(async (tx) => {
    await tx.specialRoundResult.deleteMany({
      where: { market: { specialRoundId: round.id } }
    });
    await tx.specialRoundMarketOption.deleteMany({
      where: { market: { specialRoundId: round.id } }
    });
    await tx.specialRoundMarket.deleteMany({ where: { specialRoundId: round.id } });
    await tx.specialRoundAuditLog.deleteMany({ where: { specialRoundId: round.id } });
    await tx.specialRound.delete({ where: { id: round.id } });
  }, serializable);
  revalidateSpecialRounds();
  return { message: "Rodada excluida.", ok: true };
}

export async function cancelSpecialRoundAction(
  specialRoundId: string
): Promise<SpecialRoundActionResult> {
  return updateSpecialRoundStatusAction({
    specialRoundId,
    status: "CANCELLED" satisfies SpecialRoundStatus
  });
}
