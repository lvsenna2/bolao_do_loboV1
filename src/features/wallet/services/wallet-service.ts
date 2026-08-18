import type { Prisma, WalletTransactionType } from "@prisma/client";

import { prisma } from "@/server/db";

/**
 * A carteira tem dois baldes: `balanceCents` (saldo normal, sacavel) e `bonusBalanceCents`
 * (saldo bonus de promocoes). O bonus vira saldo normal quando o rollover chega a zero.
 */
export type WalletBucket = "REAL" | "BONUS";
/** ROLLOVER mantem premios no bonus enquanto houver meta; depois credita no saldo normal. */
export type WalletCreditBucket = WalletBucket | "ROLLOVER";

export const BONUS_ROLLOVER_MULTIPLIER = 10;

/** ANY gasta o bonus primeiro e so entao o saldo normal. REAL_ONLY ignora o bonus (saques). */
export type WalletDebitSource = "ANY" | "REAL_ONLY";

type WalletMutation = {
  amountCents: number;
  description: string;
  relatedEntityId?: string;
  type: WalletTransactionType;
  uniqueKey: string;
  userId: string;
};

type WalletCreditMutation = WalletMutation & {
  bucket?: WalletCreditBucket;
  rolloverRequirementCents?: number;
};

type WalletReverseMutation = WalletMutation & { bucket?: WalletBucket };

type WalletDebitMutation = WalletMutation & { source?: WalletDebitSource };

function assertAmount(amountCents: number) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("WALLET_INVALID_AMOUNT");
  }
}

function assertRolloverRequirement(amountCents: number) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new Error("WALLET_INVALID_ROLLOVER_REQUIREMENT");
  }
}

async function ensureWallet(tx: Prisma.TransactionClient, userId: string) {
  await tx.wallet.upsert({
    create: {
      balanceCents: 0,
      bonusBalanceCents: 0,
      bonusRolloverRemainingCents: 0,
      userId
    },
    update: {},
    where: { userId }
  });
  return tx.wallet.findUniqueOrThrow({ where: { userId } });
}

function totalOf(wallet: { balanceCents: number; bonusBalanceCents: number }) {
  return wallet.balanceCents + wallet.bonusBalanceCents;
}

export async function creditWalletInTransaction(
  tx: Prisma.TransactionClient,
  input: WalletCreditMutation
) {
  assertAmount(input.amountCents);
  const rolloverRequirementCents = input.rolloverRequirementCents ?? 0;
  assertRolloverRequirement(rolloverRequirementCents);
  if (rolloverRequirementCents > 0 && input.bucket !== "BONUS") {
    throw new Error("WALLET_ROLLOVER_REQUIRES_BONUS_BUCKET");
  }
  const existing = await tx.walletTransaction.findUnique({ where: { uniqueKey: input.uniqueKey } });
  if (existing) return existing;

  const before = await ensureWallet(tx, input.userId);
  const toBonus =
    input.bucket === "BONUS" ||
    (input.bucket === "ROLLOVER" && before.bonusRolloverRemainingCents > 0);
  const after = await tx.wallet.update({
    data: toBonus
      ? {
          bonusBalanceCents: { increment: input.amountCents },
          bonusRolloverRemainingCents: { increment: rolloverRequirementCents }
        }
      : { balanceCents: { increment: input.amountCents } },
    where: { userId: input.userId }
  });

  return tx.walletTransaction.create({
    data: {
      amountCents: input.amountCents,
      balanceAfterCents: totalOf(after),
      balanceBeforeCents: totalOf(before),
      bonusAmountCents: toBonus ? input.amountCents : 0,
      bonusUnlockedCents: 0,
      description: input.description,
      relatedEntityId: input.relatedEntityId,
      type: input.type,
      uniqueKey: input.uniqueKey,
      userId: input.userId
    }
  });
}

export async function debitWalletInTransaction(
  tx: Prisma.TransactionClient,
  input: WalletDebitMutation
) {
  assertAmount(input.amountCents);
  const existing = await tx.walletTransaction.findUnique({ where: { uniqueKey: input.uniqueKey } });
  if (existing) return existing;

  const before = await ensureWallet(tx, input.userId);
  const bonusPart =
    input.source === "REAL_ONLY" ? 0 : Math.min(before.bonusBalanceCents, input.amountCents);
  const realPart = input.amountCents - bonusPart;
  const rolloverAppliedCents =
    input.type === "BET" ? Math.min(before.bonusRolloverRemainingCents, input.amountCents) : 0;
  const completesRollover =
    before.bonusRolloverRemainingCents > 0 &&
    rolloverAppliedCents === before.bonusRolloverRemainingCents;
  const unlockedBonusCents = completesRollover ? before.bonusBalanceCents - bonusPart : 0;

  // `updateMany` com o saldo no filtro garante que dois pedidos concorrentes nao gastem o
  // mesmo dinheiro: quem chegar depois nao encontra a linha e a transacao inteira falha.
  const changed = completesRollover
    ? await tx.wallet.updateMany({
        data: {
          balanceCents: before.balanceCents - realPart + unlockedBonusCents,
          bonusBalanceCents: 0,
          bonusRolloverRemainingCents: 0
        },
        where: {
          balanceCents: before.balanceCents,
          bonusBalanceCents: before.bonusBalanceCents,
          bonusRolloverRemainingCents: before.bonusRolloverRemainingCents,
          userId: input.userId
        }
      })
    : await tx.wallet.updateMany({
        data: {
          balanceCents: { decrement: realPart },
          bonusBalanceCents: { decrement: bonusPart },
          bonusRolloverRemainingCents: { decrement: rolloverAppliedCents }
        },
        where: {
          balanceCents: { gte: realPart },
          bonusBalanceCents: { gte: bonusPart },
          bonusRolloverRemainingCents: { gte: rolloverAppliedCents },
          userId: input.userId
        }
      });
  if (changed.count !== 1) throw new Error("WALLET_INSUFFICIENT_BALANCE");

  return tx.walletTransaction.create({
    data: {
      amountCents: -input.amountCents,
      balanceAfterCents: totalOf(before) - input.amountCents,
      balanceBeforeCents: totalOf(before),
      bonusAmountCents: bonusPart === 0 ? 0 : -bonusPart,
      bonusUnlockedCents: unlockedBonusCents,
      description: input.description,
      relatedEntityId: input.relatedEntityId,
      type: input.type,
      uniqueKey: input.uniqueKey,
      userId: input.userId
    }
  });
}

export async function reverseWalletCreditInTransaction(
  tx: Prisma.TransactionClient,
  input: WalletReverseMutation
) {
  assertAmount(input.amountCents);
  const existing = await tx.walletTransaction.findUnique({ where: { uniqueKey: input.uniqueKey } });
  if (existing) return existing;

  const before = await ensureWallet(tx, input.userId);
  const fromBonus = input.bucket === "BONUS";
  const after = await tx.wallet.update({
    data: fromBonus
      ? { bonusBalanceCents: { decrement: input.amountCents } }
      : { balanceCents: { decrement: input.amountCents } },
    where: { userId: input.userId }
  });

  return tx.walletTransaction.create({
    data: {
      amountCents: -input.amountCents,
      balanceAfterCents: totalOf(after),
      balanceBeforeCents: totalOf(before),
      bonusAmountCents: fromBonus ? -input.amountCents : 0,
      bonusUnlockedCents: 0,
      description: input.description,
      relatedEntityId: input.relatedEntityId,
      type: input.type,
      uniqueKey: input.uniqueKey,
      userId: input.userId
    }
  });
}

export async function getWalletBalance(userId: string) {
  const wallet = await prisma.wallet.findUnique({
    select: {
      balanceCents: true,
      bonusBalanceCents: true,
      bonusRolloverRemainingCents: true
    },
    where: { userId }
  });
  const balanceCents = wallet?.balanceCents ?? 0;
  const bonusBalanceCents = wallet?.bonusBalanceCents ?? 0;
  const bonusRolloverRemainingCents = wallet?.bonusRolloverRemainingCents ?? 0;
  return {
    /** Saldo normal, o unico que pode virar saque. */
    balanceCents,
    bonusBalanceCents,
    bonusRolloverRemainingCents,
    /** O que o usuario ve como "saldo" e pode gastar na plataforma. */
    totalCents: balanceCents + bonusBalanceCents
  };
}

export function formatCents(value: number) {
  return new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" }).format(value / 100);
}
