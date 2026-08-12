import type { Prisma, WalletTransactionType } from "@prisma/client";

import { prisma } from "@/server/db";

type WalletMutation = {
  amountCents: number;
  description: string;
  relatedEntityId?: string;
  type: WalletTransactionType;
  uniqueKey: string;
  userId: string;
};

function assertAmount(amountCents: number) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("WALLET_INVALID_AMOUNT");
  }
}

export async function creditWalletInTransaction(
  tx: Prisma.TransactionClient,
  input: WalletMutation
) {
  assertAmount(input.amountCents);
  const existing = await tx.walletTransaction.findUnique({ where: { uniqueKey: input.uniqueKey } });
  if (existing) return existing;

  await tx.wallet.upsert({
    create: { balanceCents: 0, userId: input.userId },
    update: {},
    where: { userId: input.userId }
  });
  const before = await tx.wallet.findUniqueOrThrow({ where: { userId: input.userId } });
  const after = await tx.wallet.update({
    data: { balanceCents: { increment: input.amountCents } },
    where: { userId: input.userId }
  });

  return tx.walletTransaction.create({
    data: {
      amountCents: input.amountCents,
      balanceAfterCents: after.balanceCents,
      balanceBeforeCents: before.balanceCents,
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
  input: WalletMutation
) {
  assertAmount(input.amountCents);
  const existing = await tx.walletTransaction.findUnique({ where: { uniqueKey: input.uniqueKey } });
  if (existing) return existing;

  await tx.wallet.upsert({
    create: { balanceCents: 0, userId: input.userId },
    update: {},
    where: { userId: input.userId }
  });
  const before = await tx.wallet.findUniqueOrThrow({ where: { userId: input.userId } });
  const changed = await tx.wallet.updateMany({
    data: { balanceCents: { decrement: input.amountCents } },
    where: { balanceCents: { gte: input.amountCents }, userId: input.userId }
  });
  if (changed.count !== 1) throw new Error("WALLET_INSUFFICIENT_BALANCE");

  return tx.walletTransaction.create({
    data: {
      amountCents: -input.amountCents,
      balanceAfterCents: before.balanceCents - input.amountCents,
      balanceBeforeCents: before.balanceCents,
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
  input: WalletMutation
) {
  assertAmount(input.amountCents);
  const existing = await tx.walletTransaction.findUnique({ where: { uniqueKey: input.uniqueKey } });
  if (existing) return existing;

  await tx.wallet.upsert({
    create: { balanceCents: 0, userId: input.userId },
    update: {},
    where: { userId: input.userId }
  });
  const before = await tx.wallet.findUniqueOrThrow({ where: { userId: input.userId } });
  const after = await tx.wallet.update({
    data: { balanceCents: { decrement: input.amountCents } },
    where: { userId: input.userId }
  });

  return tx.walletTransaction.create({
    data: {
      amountCents: -input.amountCents,
      balanceAfterCents: after.balanceCents,
      balanceBeforeCents: before.balanceCents,
      description: input.description,
      relatedEntityId: input.relatedEntityId,
      type: input.type,
      uniqueKey: input.uniqueKey,
      userId: input.userId
    }
  });
}

export function getWalletBalance(userId: string) {
  return prisma.wallet.findUnique({ select: { balanceCents: true }, where: { userId } });
}

export function formatCents(value: number) {
  return new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" }).format(value / 100);
}
