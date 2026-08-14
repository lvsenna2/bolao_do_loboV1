"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { debitWalletInTransaction, formatCents } from "@/features/wallet/services/wallet-service";
import { serverNow } from "@/lib/date-time";
import { requireAdmin, requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";

import {
  idSchema,
  promoSpecialRoundSchema,
  promoStakeSchema
} from "../schemas/special-round-schemas";
import {
  checkPromoStake,
  isPromoBettingOpen,
  promoMaxStakeCents,
  promoMinStakeCents,
  promoProfitCents,
  promoReturnCents
} from "../services/promo-service";
import type { SpecialRoundActionResult } from "../types";

const serializable = { isolationLevel: "Serializable" as const };

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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

function revalidatePromoRound(round: { id: string; promoSlug: string | null }) {
  revalidatePath("/rodadas-especiais");
  revalidatePath("/admin/rodadas-especiais");
  revalidatePath(`/rodadas-especiais/${round.id}`);
  if (round.promoSlug) revalidatePath(`/rodadas-especiais/${round.promoSlug}`);
  revalidatePath("/carteira");
}

/**
 * A promocao roda em cima da mesma tabela das Rodadas Especiais. O que muda e o `format`, o
 * unico mercado (TEAM_TO_SCORE) criado junto e a premiacao, que nao usa bolo nem ranking:
 * cada aposta ganhadora recebe o proprio retorno, com o lucro em saldo bonus.
 */
function promoRoundFields(value: z.infer<typeof promoSpecialRoundSchema>) {
  return {
    awayTeamLogo: value.awayTeamLogo || null,
    awayTeamName: value.awayTeamName,
    description: value.description || null,
    fixedPrize: 0,
    format: "PROMO_SINGLE_SELECTION" as const,
    homeTeamLogo: value.homeTeamLogo || null,
    homeTeamName: value.homeTeamName,
    matchId: value.matchId || null,
    matchStartsAt: value.matchStartsAt,
    name: value.name,
    // Rodada promocional nao tem inscricao nem palpite: as quatro datas seguem a janela de
    // apostas para que os jobs e telas existentes continuem enxergando a rodada.
    predictionsCloseAt: value.promoBetsCloseAt,
    predictionsOpenAt: value.promoBetsOpenAt,
    prizeDistribution: json([{ percent: 100, position: 1 }]),
    prizeMode: "FIXED" as const,
    promoBannerUrl: value.promoBannerUrl || null,
    promoHeadline: value.promoHeadline || null,
    promoMaxStakeCents: value.promoMaxStakeCents,
    promoMinStakeCents: value.promoMinStakeCents,
    promoOdds: value.promoOdds,
    promoSelectionLabel: value.promoSelectionLabel,
    promoSide: value.promoSide,
    promoSlug: value.promoSlug,
    registrationClosesAt: value.promoBetsCloseAt,
    registrationOpensAt: value.promoBetsOpenAt,
    rules: value.rules || null,
    winnerCount: 1
  };
}

export async function createPromoSpecialRoundAction(
  input: unknown
): Promise<SpecialRoundActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  const parsed = promoSpecialRoundSchema.safeParse(input);
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrors(parsed.error),
      message: "Revise os dados da promocao.",
      ok: false
    };
  }
  const value = parsed.data;
  const taken = await prisma.specialRound.findUnique({ where: { promoSlug: value.promoSlug } });
  if (taken) {
    return {
      fieldErrors: { promoSlug: ["Ja existe uma promocao com esse link."] },
      message: "Escolha outro link para a campanha.",
      ok: false
    };
  }

  const created = await prisma.$transaction(async (tx) => {
    const round = await tx.specialRound.create({
      data: { ...promoRoundFields(value), createdById: admin.id },
      select: { id: true, name: true, promoSlug: true }
    });
    await tx.specialRoundMarket.create({
      data: {
        answerType: "BOOLEAN",
        description: "Selecao unica da promocao.",
        kind: "TEAM_TO_SCORE",
        // A unica opcao carrega o lado cobrado: e dela que a apuracao automatica le
        // se a pergunta era sobre o mandante ou o visitante.
        options: {
          create: [
            {
              label: value.promoSide === "AWAY" ? value.awayTeamName : value.homeTeamName,
              value: value.promoSide
            }
          ]
        },
        points: 1,
        required: true,
        sortOrder: 0,
        specialRoundId: round.id,
        title: value.promoSelectionLabel
      }
    });
    await tx.specialRoundAuditLog.create({
      data: {
        action: "special_round.promo_created",
        actorId: admin.id,
        entity: "SpecialRound",
        entityId: round.id,
        newValue: json({
          maxStakeCents: value.promoMaxStakeCents,
          odds: value.promoOdds,
          selection: value.promoSelectionLabel,
          slug: value.promoSlug
        }),
        specialRoundId: round.id
      }
    });
    return round;
  }, serializable);

  revalidatePromoRound(created);
  return { data: { id: created.id }, message: "Promocao criada como rascunho.", ok: true };
}

export async function updatePromoSpecialRoundAction(
  specialRoundId: string,
  input: unknown
): Promise<SpecialRoundActionResult> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(specialRoundId);
  const parsed = promoSpecialRoundSchema.safeParse(input);
  if (!id.success || !parsed.success) {
    return {
      fieldErrors: parsed.success ? undefined : fieldErrors(parsed.error),
      message: "Revise os dados da promocao.",
      ok: false
    };
  }
  const current = await prisma.specialRound.findUnique({
    include: { _count: { select: { entries: true } } },
    where: { id: id.data }
  });
  if (!current || current.format !== "PROMO_SINGLE_SELECTION") {
    return { message: "Promocao nao encontrada.", ok: false };
  }
  if (["FINALIZED", "CANCELLED"].includes(current.status)) {
    return { message: "Esta promocao ja foi encerrada.", ok: false };
  }
  const value = parsed.data;
  // Depois da primeira aposta a odd, o lado e o limite viram contrato com quem ja apostou.
  if (
    current._count.entries > 0 &&
    (Number(current.promoOdds) !== value.promoOdds ||
      current.promoSide !== value.promoSide ||
      current.promoMaxStakeCents !== value.promoMaxStakeCents)
  ) {
    return {
      message: "Ja existem apostas: odd, selecao e limite nao podem mais mudar.",
      ok: false
    };
  }
  const taken = await prisma.specialRound.findUnique({ where: { promoSlug: value.promoSlug } });
  if (taken && taken.id !== id.data) {
    return {
      fieldErrors: { promoSlug: ["Ja existe uma promocao com esse link."] },
      message: "Escolha outro link para a campanha.",
      ok: false
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.specialRound.update({ data: promoRoundFields(value), where: { id: id.data } });
    const market = await tx.specialRoundMarket.findFirst({
      where: { kind: "TEAM_TO_SCORE", specialRoundId: id.data }
    });
    if (market) {
      await tx.specialRoundMarket.update({
        data: { title: value.promoSelectionLabel },
        where: { id: market.id }
      });
      await tx.specialRoundMarketOption.updateMany({
        data: {
          label: value.promoSide === "AWAY" ? value.awayTeamName : value.homeTeamName,
          value: value.promoSide
        },
        where: { marketId: market.id }
      });
    }
    await tx.specialRoundAuditLog.create({
      data: {
        action: "special_round.promo_updated",
        actorId: admin.id,
        entity: "SpecialRound",
        entityId: id.data,
        newValue: json({ odds: value.promoOdds, selection: value.promoSelectionLabel }),
        specialRoundId: id.data
      }
    });
  }, serializable);

  revalidatePromoRound({ id: id.data, promoSlug: value.promoSlug });
  return { message: "Promocao atualizada.", ok: true };
}

export type PromoBetResult = {
  bonusIfWinsLabel: string;
  remainingCentsAfter: number;
  returnLabel: string;
  stakedTotalCents: number;
};

/**
 * Aposta na promocao. Tudo que decide dinheiro — odd, limite acumulado, janela e saldo — e
 * lido do banco aqui dentro; o cliente so manda o valor.
 */
export async function placePromoBetAction(
  input: unknown
): Promise<SpecialRoundActionResult<PromoBetResult>> {
  const user = await requireUser();
  const parsed = promoStakeSchema.safeParse(input);
  if (!parsed.success) return { message: "Informe um valor valido.", ok: false };

  const round = await prisma.specialRound.findUnique({
    include: { match: { select: { status: true } } },
    where: { id: parsed.data.specialRoundId }
  });
  if (!round || round.format !== "PROMO_SINGLE_SELECTION" || !round.promoOdds) {
    return { message: "Promocao nao encontrada.", ok: false };
  }

  const now = serverNow();
  if (
    !isPromoBettingOpen({
      closesAt: round.registrationClosesAt,
      matchStatus: round.match?.status,
      now,
      opensAt: round.registrationOpensAt,
      status: round.status
    })
  ) {
    return { message: "Esta promocao nao esta mais aceitando apostas.", ok: false };
  }

  const odds = Number(round.promoOdds);
  const maxStakeCents = promoMaxStakeCents(round);
  const minStakeCents = promoMinStakeCents(round);
  const stakeCents = parsed.data.stakeCents;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.specialRoundEntry.findUnique({
        where: { specialRoundId_userId: { specialRoundId: round.id, userId: user.id } }
      });
      if (existing?.blockedAt) throw new Error("PROMO_ENTRY_BLOCKED");
      // Aposta ja estornada nao volta a valer com um novo aporte por cima.
      if (existing && existing.paymentStatus === "REFUNDED") throw new Error("PROMO_ENTRY_BLOCKED");
      const alreadyStakedCents = existing ? Math.round(Number(existing.amount) * 100) : 0;
      const check = checkPromoStake({
        alreadyStakedCents,
        maxStakeCents,
        minStakeCents,
        stakeCents
      });
      if (!check.ok) throw new Error(`PROMO_${check.reason}`);

      // A chave leva o total acumulado, entao reenviar o mesmo formulario nao cobra duas
      // vezes. O debito seria ignorado em silencio nesse caso, mas o resto da transacao
      // nao e idempotente — por isso a duplicata para aqui.
      const stakeKey = `wallet:promo-round:${round.id}:user:${user.id}:total:${check.totalAfterCents}`;
      const duplicated = await tx.walletTransaction.findUnique({ where: { uniqueKey: stakeKey } });
      if (duplicated) throw new Error("PROMO_DUPLICATED");

      const debit = await debitWalletInTransaction(tx, {
        amountCents: stakeCents,
        description: `Aposta na promocao ${round.name}`,
        relatedEntityId: round.id,
        type: "BET",
        uniqueKey: stakeKey,
        userId: user.id
      });
      const bonusUsedCents = Math.abs(debit.bonusAmountCents);

      const entry = await tx.specialRoundEntry.upsert({
        create: {
          amount: check.totalAfterCents / 100,
          bonusAmount: bonusUsedCents / 100,
          confirmedAt: now,
          paymentGateway: "MANUAL",
          paymentStatus: "APPROVED",
          providerStatus: "wallet",
          specialRoundId: round.id,
          userId: user.id
        },
        update: {
          amount: check.totalAfterCents / 100,
          bonusAmount: { increment: bonusUsedCents / 100 },
          confirmedAt: existing?.confirmedAt ?? now,
          paymentStatus: "APPROVED",
          providerStatus: "wallet"
        },
        where: { specialRoundId_userId: { specialRoundId: round.id, userId: user.id } }
      });

      // A selecao e unica e ja esta escolhida: o palpite existe so para a apuracao padrao
      // (acertou/errou) continuar valendo para a promocao.
      const market = await tx.specialRoundMarket.findFirstOrThrow({
        where: { kind: "TEAM_TO_SCORE", specialRoundId: round.id }
      });
      await tx.specialRoundPrediction.upsert({
        create: { answer: true, entryId: entry.id, marketId: market.id, userId: user.id },
        update: {},
        where: { entryId_marketId: { entryId: entry.id, marketId: market.id } }
      });

      await tx.specialRoundAuditLog.create({
        data: {
          action: "special_round.promo_bet_placed",
          actorId: user.id,
          entity: "SpecialRoundEntry",
          entityId: entry.id,
          newValue: json({
            bonusUsedCents,
            stakeCents,
            totalStakedCents: check.totalAfterCents
          }),
          specialRoundId: round.id
        }
      });

      return check.totalAfterCents;
    }, serializable);

    revalidatePromoRound(round);
    return {
      data: {
        bonusIfWinsLabel: formatCents(promoProfitCents(result, odds)),
        remainingCentsAfter: maxStakeCents - result,
        returnLabel: formatCents(promoReturnCents(result, odds)),
        stakedTotalCents: result
      },
      message: `Aposta confirmada. Se bater, voce recebe ${formatCents(
        promoReturnCents(result, odds)
      )}.`,
      ok: true
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "WALLET_INSUFFICIENT_BALANCE") {
      return { message: "Saldo insuficiente. Adicione saldo para apostar.", ok: false };
    }
    if (code === "PROMO_LIMIT_REACHED") {
      return {
        message: `Voce ja usou o limite de ${formatCents(maxStakeCents)} nesta promocao.`,
        ok: false
      };
    }
    if (code === "PROMO_ABOVE_REMAINING") {
      return {
        message: `Nesta promocao voce ainda pode apostar ate ${formatCents(maxStakeCents)} no total.`,
        ok: false
      };
    }
    if (code === "PROMO_BELOW_MIN") {
      return { message: `Aposta minima de ${formatCents(minStakeCents)}.`, ok: false };
    }
    if (code === "PROMO_DUPLICATED") {
      return { message: "Essa aposta ja foi registrada.", ok: false };
    }
    if (code === "PROMO_ENTRY_BLOCKED") {
      return { message: "Sua participacao nesta promocao esta bloqueada.", ok: false };
    }
    console.error("Promo bet failed", { error, specialRoundId: round.id });
    return { message: "Nao foi possivel registrar sua aposta.", ok: false };
  }
}
