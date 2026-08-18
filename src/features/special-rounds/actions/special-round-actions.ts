"use server";

import type { Prisma, SpecialRoundStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { serverNow } from "@/lib/date-time";
import { requireAdmin, requireUser } from "@/server/auth/session";
import { canAccessAdmin } from "@/server/auth/rbac";
import { canCreateSpecialRound } from "@/features/subscriptions/service";
import { debitWalletInTransaction } from "@/features/wallet/services/wallet-service";
import { prisma } from "@/server/db";
import { runFootballAutomation } from "@/server/football-api/automation-service";
import { fetchApiFootballLineups } from "@/server/football-api/client";
import { saveFixtureLineups } from "@/server/football-api/detail-service";
import { getMercadoPagoPayment, refundMercadoPagoPayment } from "@/server/mercado-pago/client";
import { createSpecialRoundPix, reconcileSpecialRoundPayment } from "../services/payment-service";
import {
  calculateSpecialRound,
  createSpecialRoundFinalizedNotifications,
  creditSpecialRoundPrizeToWallet,
  refundPromoRoundEntries,
  settleSpecialRoundFromCatalog
} from "../services/settlement-service";
import {
  buildAutomaticSpecialRoundMarkets,
  buildGoalScorerOptions,
  getGoalScorerPlayerValue,
  type GoalScorerPlayerOption
} from "../services/default-markets";
import { shouldReuseSpecialRoundLineup } from "../services/lineup-market-service";
import { resolveApiBackedSpecialRoundMatch } from "../services/match-link-service";
import {
  fetchSquadGoalScorerCandidates,
  getStoredGoalScorerCandidates
} from "../services/scorer-candidates-service";
import {
  assertSpecialRoundTransition,
  blockingSpecialRoundStatuses,
  canDeleteSpecialRoundEntries,
  isPredictionWindowOpen
} from "../services/state-service";
import {
  automaticSpecialRoundSchema,
  idSchema,
  predictionBatchSchema,
  resultBatchSchema,
  specialRoundMarketSchema,
  specialRoundSchema,
  statusTransitionSchema
} from "../schemas/special-round-schemas";
import type { SpecialRoundActionResult } from "../types";

const serializable = { isolationLevel: "Serializable" as const };

function revalidateSpecialRounds(id?: string) {
  revalidatePath("/rodadas-especiais");
  revalidatePath("/rodadas-especiais/historico");
  revalidatePath("/admin/rodadas-especiais");
  revalidatePath("/notificacoes");
  if (id) {
    revalidatePath(`/rodadas-especiais/${id}`);
    revalidatePath(`/rodadas-especiais/${id}/meu-palpite`);
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
  const admin = await requireUser();
  if (!canAccessAdmin(admin.role) && !(await canCreateSpecialRound(admin.id))) {
    return { message: "A criacao de Rodadas Especiais exige o plano Platinum.", ok: false };
  }
  const parsed = automaticSpecialRoundSchema.safeParse(input);
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrors(parsed.error),
      message: "Selecione uma partida e informe um valor de inscricao valido.",
      ok: false
    };
  }

  try {
    const match = await prisma.match.findFirst({
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

    const activeRound = await prisma.specialRound.findFirst({
      select: { id: true },
      where: { matchId: match.id, status: { in: blockingSpecialRoundStatuses } }
    });
    if (activeRound) {
      return {
        data: { id: activeRound.id },
        message: "Esta partida ja possui uma Rodada Especial ativa.",
        ok: true
      };
    }

    let players: GoalScorerPlayerOption[] = [
      ...match.lineups.flatMap((lineup) =>
        lineup.players.map((item) => ({
          id: item.player.id,
          name: item.player.name,
          side: lineup.teamId === match.homeTeamId ? ("HOME" as const) : ("AWAY" as const)
        }))
      ),
      ...match.playerStatistics.map((item) => ({
        id: item.player.id,
        name: item.player.name,
        side: item.teamId === match.homeTeamId ? ("HOME" as const) : ("AWAY" as const)
      }))
    ];
    let playerSource: "LINEUP" | "NONE" | "SQUAD" = players.length ? "LINEUP" : "NONE";
    let squadCallsUsed = 0;
    if (new Set(players.map((player) => player.side)).size < 2) {
      try {
        const squadCandidates = await fetchSquadGoalScorerCandidates({
          awayTeam: { apiId: match.awayTeam.apiId, side: "AWAY" },
          homeTeam: { apiId: match.homeTeam.apiId, side: "HOME" }
        });
        squadCallsUsed = squadCandidates.callsUsed;
        if (squadCandidates.players.length > 0) {
          players = squadCandidates.players;
          playerSource = "SQUAD";
        }
      } catch (error) {
        console.error("Special round squad fallback failed", {
          error,
          matchId: match.id
        });
      }
    }
    const markets = buildAutomaticSpecialRoundMarkets(
      match.homeTeam.name,
      match.awayTeam.name,
      players
    );
    const scorerMarket = markets.find((market) => market.kind === "GOAL_SCORER");
    if (scorerMarket && playerSource === "SQUAD") {
      scorerMarket.description =
        "Escolha no elenco atual. A lista sera atualizada quando a escalacao oficial for publicada.";
    }
    const championship = match.round.season.championship.name;
    const round = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.specialRound.findFirst({
          select: { id: true, name: true },
          where: { matchId: match.id, status: { in: blockingSpecialRoundStatuses } }
        });
        if (existing) return { ...existing, created: false };

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
              "Uma inscricao por participante. Os mercados sao apurados com os dados oficiais da partida catalogada. Em caso de empate, valem os criterios publicados da Rodada Especial.",
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
            metadata: json({
              matchId: match.id,
              markets: markets.length,
              playerSource,
              squadCallsUsed
            }),
            specialRoundId: created.id
          }
        });
        return { ...created, created: true };
      },
      { isolationLevel: "Serializable", maxWait: 5_000, timeout: 20_000 }
    );

    if (round.created) {
      try {
        const users = await prisma.user.findMany({
          select: { id: true },
          where: { deletedAt: null, status: "ACTIVE" }
        });
        await prisma.notification.createMany({
          data: users.map((user) => ({
            body: `${round.name} esta aberta para inscricoes e palpites.`,
            icon: "special-round",
            message: `${round.name} esta aberta para inscricoes e palpites.`,
            relatedEntityId: round.id,
            title: "Nova rodada especial",
            type: "SPECIAL_ROUND" as const,
            uniqueKey: `special-round:opened:${round.id}:${user.id}`,
            userId: user.id
          })),
          skipDuplicates: true
        });
      } catch (notificationError) {
        console.error("Special round creation notification failed", {
          error: notificationError,
          specialRoundId: round.id
        });
      }
    }

    revalidateSpecialRounds(round.id);
    return {
      data: { id: round.id },
      message: round.created
        ? "Rodada aberta com os doze mercados automaticos."
        : "Esta partida ja possui uma Rodada Especial ativa.",
      ok: true
    };
  } catch (error) {
    console.error("Automatic special round creation failed", {
      code: typeof error === "object" && error && "code" in error ? String(error.code) : undefined,
      error,
      matchId: parsed.data.matchId
    });
    const message =
      error instanceof Error && error.message === "MATCH_ALREADY_STARTED"
        ? "Escolha uma partida que ainda nao comecou."
        : error instanceof Error && error.message === "MATCH_NOT_FOUND"
          ? "A partida nao foi encontrada no catalogo."
          : typeof error === "object" && error && "code" in error && error.code === "P2028"
            ? "O banco demorou para criar a rodada. Tente novamente; nenhuma duplicata sera criada."
            : "Nao foi possivel criar a rodada automaticamente.";
    return { message, ok: false };
  }
}

function normalizedPlayerName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export async function syncSpecialRoundLineupAction(
  specialRoundId: string
): Promise<SpecialRoundActionResult<{ playerCount: number }>> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(specialRoundId);
  if (!id.success) return { message: "Rodada invalida.", ok: false };
  await resolveApiBackedSpecialRoundMatch(id.data);

  const round = await prisma.specialRound.findUnique({
    include: {
      match: {
        include: {
          awayTeam: true,
          homeTeam: true,
          lineups: {
            include: {
              players: { include: { player: true } }
            }
          }
        }
      }
    },
    where: { id: id.data }
  });
  if (!round?.match) {
    return { message: "Esta rodada nao possui uma partida catalogada.", ok: false };
  }
  const match = round.match;
  if (!match.apiId) {
    return { message: "A partida nao possui fixtureId da API-Football.", ok: false };
  }

  const storedLineupComplete =
    match.lineups.length >= 2 && match.lineups.every((lineup) => lineup.complete);
  const reusedStoredLineup = shouldReuseSpecialRoundLineup({
    complete: storedLineupComplete,
    now: serverNow(),
    syncedAt: match.lineupsSyncedAt
  });

  if (!reusedStoredLineup) {
    try {
      const result = await fetchApiFootballLineups(match.apiId);
      if (!result.ok) {
        return {
          message: `Nao foi possivel consultar a escalacao: ${result.message}`,
          ok: false
        };
      }
      if (result.data.length === 0) {
        await prisma.match.update({
          data: { lineupsSyncedAt: serverNow() },
          where: { id: match.id }
        });
      } else {
        await saveFixtureLineups([match.id], result.data);
      }
    } catch (error) {
      console.error("Special round lineup sync failed", {
        error,
        fixtureId: match.apiId,
        specialRoundId: round.id
      });
      return {
        message: "A consulta da escalacao foi interrompida. Tente novamente em alguns instantes.",
        ok: false
      };
    }
  }

  const storedLineups = await prisma.matchLineup.findMany({
    include: {
      players: {
        include: { player: true },
        orderBy: [{ role: "asc" }, { sortOrder: "asc" }]
      }
    },
    where: { matchId: match.id }
  });
  const usableLineups =
    storedLineups.length >= 2 && storedLineups.every((lineup) => lineup.players.length > 0);
  const completeLineups = usableLineups && storedLineups.every((lineup) => lineup.complete);
  let candidateSource: "LINEUP" | "SQUAD" = "LINEUP";
  let players: GoalScorerPlayerOption[] = await getStoredGoalScorerCandidates(match.id);
  if (!usableLineups) {
    try {
      const squadCandidates = await fetchSquadGoalScorerCandidates({
        awayTeam: { apiId: match.awayTeam.apiId, side: "AWAY" },
        homeTeam: { apiId: match.homeTeam.apiId, side: "HOME" }
      });
      if (squadCandidates.players.length > 0) {
        players = squadCandidates.players;
        candidateSource = "SQUAD";
      }
    } catch (error) {
      console.error("Special round squad candidate sync failed", {
        error,
        fixtureId: match.apiId,
        specialRoundId: round.id
      });
    }
  }
  const playerOptions = buildGoalScorerOptions(players);
  if (playerOptions.length <= 1) {
    return {
      message: "A escalacao foi consultada, mas ainda nao possui jogadores disponiveis.",
      ok: false
    };
  }

  const scorerMarket = await prisma.specialRoundMarket.findFirst({
    include: { options: true, predictions: true },
    where: { kind: "GOAL_SCORER", specialRoundId: round.id }
  });
  if (!scorerMarket) {
    return { message: "O mercado de primeiro jogador nao foi encontrado.", ok: false };
  }

  const optionByName = new Map(
    playerOptions
      .filter((option) => option.value.startsWith("PLAYER:"))
      .map((option) => [normalizedPlayerName(option.label), option.value])
  );
  const optionByPlayerValue = new Map(
    playerOptions
      .filter((option) => option.value.startsWith("PLAYER:"))
      .map((option) => [getGoalScorerPlayerValue(option.value), option.value])
  );
  const migratedAnswers = new Map<string, string>();
  const legacyOptions = new Map<string, string>();
  const storedOptionLabels = new Map(
    scorerMarket.options.map((option) => [option.value, option.label])
  );

  for (const prediction of scorerMarket.predictions) {
    if (typeof prediction.answer !== "string" || prediction.answer === "NO_GOAL") continue;
    if (prediction.answer.startsWith("PLAYER:")) {
      const matchedValue = optionByPlayerValue.get(getGoalScorerPlayerValue(prediction.answer));
      if (matchedValue) migratedAnswers.set(prediction.id, matchedValue);
      else
        legacyOptions.set(
          prediction.answer,
          storedOptionLabels.get(prediction.answer) ?? prediction.answer
        );
      continue;
    }
    const matchedValue = optionByName.get(normalizedPlayerName(prediction.answer));
    if (matchedValue) migratedAnswers.set(prediction.id, matchedValue);
    else legacyOptions.set(prediction.answer, prediction.answer);
  }

  const availableOptions = [
    ...playerOptions,
    ...Array.from(legacyOptions, ([value, label]) => ({ label, value })).filter(
      (option) => !playerOptions.some((current) => current.value === option.value)
    )
  ];

  try {
    const operations: Prisma.PrismaPromise<unknown>[] = [
      prisma.specialRoundMarketOption.updateMany({
        data: { active: false },
        where: { marketId: scorerMarket.id }
      }),
      ...availableOptions.map((option, sortOrder) =>
        prisma.specialRoundMarketOption.upsert({
          create: {
            active: true,
            label: option.label,
            marketId: scorerMarket.id,
            sortOrder,
            value: option.value
          },
          update: { active: true, label: option.label, sortOrder },
          where: {
            marketId_value: {
              marketId: scorerMarket.id,
              value: option.value
            }
          }
        })
      ),
      ...Array.from(migratedAnswers, ([predictionId, answer]) =>
        prisma.specialRoundPrediction.update({
          data: { answer: json(answer) },
          where: { id: predictionId }
        })
      ),
      prisma.specialRoundMarket.update({
        data: {
          answerType: "OPTION_LIST",
          description:
            candidateSource === "LINEUP"
              ? "Escolha na escalacao oficial quem marcara o primeiro gol da partida."
              : "Escolha no elenco atual. A lista sera atualizada quando a escalacao oficial for publicada."
        },
        where: { id: scorerMarket.id }
      }),
      prisma.specialRoundAuditLog.create({
        data: {
          action: "special_round.lineup_synced",
          actorId: admin.id,
          entity: "SpecialRound",
          entityId: round.id,
          metadata: json({
            fixtureId: match.apiId,
            migratedPredictions: migratedAnswers.size,
            players: playerOptions.length - 1,
            reusedStoredLineup,
            source: candidateSource
          }),
          specialRoundId: round.id
        }
      })
    ];

    await prisma.$transaction(operations, serializable);
  } catch (error) {
    console.error("Special round lineup market update failed", {
      code: typeof error === "object" && error && "code" in error ? String(error.code) : undefined,
      error,
      fixtureId: match.apiId,
      specialRoundId: round.id
    });
    return {
      message: "A escalacao foi salva, mas a lista de jogadores nao pode ser atualizada.",
      ok: false
    };
  }

  revalidateSpecialRounds(round.id);
  return {
    data: { playerCount: playerOptions.length - 1 },
    message:
      candidateSource === "SQUAD"
        ? `A escalacao oficial ainda nao foi publicada. ${playerOptions.length - 1} jogadores dos elencos estao disponiveis provisoriamente.`
        : `${completeLineups ? "Escalacao oficial atualizada" : "Escalacao parcial atualizada"}. ${playerOptions.length - 1} jogadores estao disponiveis para palpite.`,
    ok: true
  };
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
  if (current.format === "PROMO_SINGLE_SELECTION") {
    return { message: "Use o formulario da promocao para editar esta rodada.", ok: false };
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
        await createSpecialRoundFinalizedNotifications(tx, {
          format: current.format,
          id: specialRoundId,
          name: current.name
        });
      }
      if (status === "CANCELLED") {
        // A promocao e paga so com saldo da carteira, entao o estorno e automatico e volta
        // para o balde de origem. Rodada normal continua com reembolso manual via gateway.
        const isPromo = current.format === "PROMO_SINGLE_SELECTION";
        if (isPromo) {
          await refundPromoRoundEntries(tx, { id: specialRoundId, name: current.name });
        }
        const cancelledBody = isPromo
          ? `${current.name} foi cancelada e o valor apostado voltou para a sua carteira.`
          : `${current.name} foi cancelada. Pagamentos aprovados devem ser reembolsados pelo administrador.`;
        const entries = await tx.specialRoundEntry.findMany({
          select: { id: true, userId: true },
          where: { specialRoundId }
        });
        await tx.notification.createMany({
          data: entries.map((entry) => ({
            body: cancelledBody,
            icon: "special-round-cancelled",
            message: cancelledBody,
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
  specialRoundId: string,
  paymentMethod: "PIX" | "WALLET" = "PIX"
): Promise<SpecialRoundActionResult<Record<string, unknown>>> {
  const user = await requireUser();
  const id = idSchema.safeParse(specialRoundId);
  if (!id.success) return { message: "Rodada invalida.", ok: false };
  const now = serverNow();
  const round = await prisma.specialRound.findUnique({ where: { id: id.data } });
  if (round?.format === "PROMO_SINGLE_SELECTION") {
    // Promocao nao tem inscricao: a entrada e a propria aposta, em placePromoBetAction.
    return { message: "Esta rodada usa o fluxo da promocao.", ok: false };
  }
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

  if (paymentMethod === "WALLET" && Number(round.entryFee) > 0) {
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.specialRoundEntry.findUnique({
          where: { specialRoundId_userId: { specialRoundId: round.id, userId: user.id } }
        });
        if (existing?.paymentStatus === "APPROVED") {
          throw new Error("SPECIAL_ROUND_ALREADY_JOINED");
        }
        if (existing?.transactionId) {
          throw new Error("SPECIAL_ROUND_PIX_ALREADY_CREATED");
        }

        const rewards = await tx.userRewardBalance.findUnique({ where: { userId: user.id } });
        const useVoucher = Boolean(rewards && rewards.specialRoundVouchers > 0);
        const amountCents = Math.round(Number(round.entryFee) * 100);
        const promoValid = Boolean(
          rewards?.promoExpiresAt && rewards.promoExpiresAt > now && rewards.promoDiscountPercent
        );
        const promoCents = promoValid
          ? Math.min(
              rewards?.promoDiscountMaxCents ?? 0,
              Math.floor((amountCents * (rewards?.promoDiscountPercent ?? 0)) / 100)
            )
          : 0;
        const chargeCents = Math.max(0, amountCents - promoCents);
        if (useVoucher) {
          await tx.userRewardBalance.update({
            data: { specialRoundVouchers: { decrement: 1 } },
            where: { userId: user.id }
          });
        } else {
          if (chargeCents > 0) {
            await debitWalletInTransaction(tx, {
              amountCents: chargeCents,
              description: `Entrada na rodada especial ${round.name}`,
              relatedEntityId: round.id,
              type: "BET",
              uniqueKey: `wallet:special-round:${round.id}:user:${user.id}`,
              userId: user.id
            });
          }
          if (promoCents > 0) {
            await tx.userRewardBalance.update({
              data: {
                promoDiscountMaxCents: 0,
                promoDiscountPercent: 0,
                promoExpiresAt: null
              },
              where: { userId: user.id }
            });
          }
        }
        const approved = await tx.specialRoundEntry.upsert({
          create: {
            amount: useVoucher ? 0 : chargeCents / 100,
            confirmedAt: now,
            paymentGateway: "MANUAL",
            paymentStatus: "APPROVED",
            providerStatus: useVoucher ? "voucher" : "wallet",
            specialRoundId: round.id,
            userId: user.id
          },
          update: {
            amount: useVoucher ? 0 : chargeCents / 100,
            confirmedAt: now,
            paymentGateway: "MANUAL",
            paymentStatus: "APPROVED",
            providerStatus: useVoucher ? "voucher" : "wallet"
          },
          where: { specialRoundId_userId: { specialRoundId: round.id, userId: user.id } }
        });
        await tx.specialRoundAuditLog.create({
          data: {
            action: useVoucher
              ? "special_round.entry_paid_with_voucher"
              : "special_round.entry_paid_with_wallet",
            actorId: user.id,
            entity: "SpecialRoundEntry",
            entityId: approved.id,
            newValue: json({ amountCents: useVoucher ? 0 : chargeCents, promoCents }),
            specialRoundId: round.id
          }
        });
      }, serializable);
      revalidateSpecialRounds(round.id);
      revalidatePath("/carteira");
      return { message: "Participacao liberada com saldo ou vale.", ok: true };
    } catch (error) {
      if (error instanceof Error && error.message === "WALLET_INSUFFICIENT_BALANCE") {
        return { message: "Saldo insuficiente. Adicione saldo para participar.", ok: false };
      }
      if (error instanceof Error && error.message === "SPECIAL_ROUND_PIX_ALREADY_CREATED") {
        return { message: "Ja existe um Pix pendente para esta inscricao.", ok: false };
      }
      if (error instanceof Error && error.message === "SPECIAL_ROUND_ALREADY_JOINED") {
        return { message: "Sua participacao ja esta liberada.", ok: false };
      }
      return { message: "Nao foi possivel usar o saldo nesta rodada.", ok: false };
    }
  }

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
    if (!result) throw new Error("SPECIAL_ROUND_PAYMENT_NOT_FOUND");
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
      // Na promocao o palpite e a propria selecao unica, gravada na hora da aposta.
      if (entry.specialRound.format === "PROMO_SINGLE_SELECTION") {
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
    TEAM_MOST_CARDS: [
      { label: "Casa", value: "HOME" },
      { label: "Empate", value: "DRAW" },
      { label: "Visitante", value: "AWAY" }
    ],
    TEAM_MOST_CORNERS: [
      { label: "Casa", value: "HOME" },
      { label: "Empate", value: "DRAW" },
      { label: "Visitante", value: "AWAY" }
    ],
    TEAM_MOST_SHOTS: [
      { label: "Casa", value: "HOME" },
      { label: "Empate", value: "DRAW" },
      { label: "Visitante", value: "AWAY" }
    ],
    TEAM_MOST_SHOTS_ON_GOAL: [
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
          (["BOTH_TEAMS_SCORE", "PROMO_SELECTION", "TEAM_TO_SCORE"].includes(market.kind) &&
            typeof answer === "boolean") ||
          (![
            "EXACT_SCORE",
            "TOTAL_GOALS",
            "TOTAL_CORNERS",
            "TOTAL_CARDS",
            "BOTH_TEAMS_SCORE",
            "PROMO_SELECTION",
            "TEAM_TO_SCORE"
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

  const settlement = await settleSpecialRoundFromCatalog({
    actorId: admin.id,
    specialRoundId: id.data
  });
  revalidateSpecialRounds(id.data);
  return {
    data: { missing: settlement.missing ?? [] },
    message: settlement.message,
    ok: settlement.ok
  };
}

export async function syncAndHomologateSpecialRoundAction(
  specialRoundId: string
): Promise<SpecialRoundActionResult<{ missing?: string[] }>> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(specialRoundId);
  if (!id.success) return { message: "Rodada invalida.", ok: false };

  const match = await resolveApiBackedSpecialRoundMatch(id.data);

  if (!match) {
    return {
      message: "Esta rodada nao esta vinculada a uma partida do catalogo.",
      ok: false
    };
  }
  if (!match.apiId) {
    return {
      message:
        "Nao foi encontrada uma copia desta partida importada pela API-Football. Atualize o catalogo da competicao e tente novamente.",
      ok: false
    };
  }

  const sync = await runFootballAutomation("special-round-manual", {
    fixtureLimit: 1,
    historyBudget: 0,
    includeCatalog: false,
    matchId: match.id
  });

  if ("locked" in sync && sync.locked) {
    return {
      message: "Outra sincronizacao esta em andamento. Tente novamente em instantes.",
      ok: false
    };
  }
  if (sync.summary.fixturesUpdated === 0) {
    return {
      message: `A API-Football nao atualizou esta partida: ${sync.summary.errors[0] ?? sync.message}`,
      ok: false
    };
  }

  await prisma.specialRoundAuditLog.create({
    data: {
      action: "special_round.fixture_synced_from_api",
      actorId: admin.id,
      entity: "SpecialRound",
      entityId: id.data,
      metadata: json({
        apiFixtureId: match.apiId,
        callsUsed: sync.summary.callsUsed,
        matchId: match.id,
        syncRunId: sync.runId
      }),
      specialRoundId: id.data
    }
  });

  const homologation = await homologateSpecialRoundFromCatalogAction(id.data);
  if (!homologation.ok) {
    const apiError = sync.summary.errors[0];
    return {
      data: homologation.data,
      message: `A partida foi consultada na API-Football, mas ainda nao pode ser homologada. ${homologation.message}${apiError ? ` API-Football: ${apiError}` : ""}`,
      ok: false
    };
  }

  return {
    data: homologation.data,
    message: `Partida atualizada pela API-Football. ${homologation.message}`,
    ok: true
  };
}

export async function calculateSpecialRoundAction(
  specialRoundId: string
): Promise<SpecialRoundActionResult> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(specialRoundId);
  if (!id.success) return { message: "Rodada invalida.", ok: false };
  const calculation = await calculateSpecialRound({ actorId: admin.id, specialRoundId: id.data });
  if (!calculation.ok) return { message: calculation.message, ok: false };
  revalidateSpecialRounds(id.data);
  return { message: calculation.message, ok: true };
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
  const prize = await prisma.specialRoundPrize.findUnique({
    include: {
      entry: { select: { amount: true, bonusAmount: true, userId: true } },
      specialRound: { select: { format: true, id: true, name: true, promoOdds: true } }
    },
    where: { id: id.data }
  });
  if (!prize) return { message: "Premio nao encontrado.", ok: false };
  await prisma.$transaction(async (tx) => {
    // Rodadas finalizadas antes do credito automatico ainda passam por aqui; o uniqueKey
    // do premio impede credito duplicado se ele ja tiver caido na carteira.
    await creditSpecialRoundPrizeToWallet(tx, prize.specialRound, prize);
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
  revalidatePath("/carteira");
  return { message: "Premio creditado na carteira do ganhador.", ok: true };
}

export async function deleteSpecialRoundAction(
  specialRoundId: string
): Promise<SpecialRoundActionResult> {
  await requireAdmin();
  const id = idSchema.safeParse(specialRoundId);
  if (!id.success) return { message: "Rodada invalida.", ok: false };
  const round = await prisma.specialRound.findUnique({
    include: {
      entries: {
        select: { paymentStatus: true, transactionId: true }
      }
    },
    where: { id: id.data }
  });
  if (!round) {
    return { message: "Rodada nao encontrada.", ok: false };
  }
  const canDelete = round.status === "CANCELLED" || canDeleteSpecialRoundEntries(round.entries);
  if (!canDelete) {
    return {
      message:
        "Esta rodada possui pagamento confirmado ou transacao no Mercado Pago. Cancele a rodada antes de excluir.",
      ok: false
    };
  }
  await prisma.$transaction(async (tx) => {
    await tx.specialRoundScore.deleteMany({
      where: { entry: { specialRoundId: round.id } }
    });
    await tx.specialRoundPrediction.deleteMany({
      where: { entry: { specialRoundId: round.id } }
    });
    await tx.specialRoundPrize.deleteMany({ where: { specialRoundId: round.id } });
    await tx.specialRoundStanding.deleteMany({ where: { specialRoundId: round.id } });
    await tx.specialRoundEntry.deleteMany({ where: { specialRoundId: round.id } });
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
