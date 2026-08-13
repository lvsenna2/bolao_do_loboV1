import { Prisma, type PixKeyType } from "@prisma/client";

import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import { creditWalletInTransaction, debitWalletInTransaction, formatCents } from "./wallet-service";

export const MIN_WITHDRAWAL_CENTS = 2_000;
export const MAX_WITHDRAWAL_CENTS = 500_000;

/** Enquanto um pedido esta nesses estados o dinheiro ja saiu da carteira e esta retido. */
const OPEN_STATUSES = ["REQUESTED", "APPROVED"] as const;

export type WithdrawalRequestInput = {
  amountCents: number;
  pixKey: string;
  pixKeyOwnerName: string;
  pixKeyType: PixKeyType;
  userId: string;
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");

/**
 * Valida a chave Pix no formato de cada tipo. E uma checagem de formato, nao de
 * existencia — quem confirma o dono da chave e o admin, na hora de pagar.
 */
export function normalizePixKey(type: PixKeyType, rawKey: string) {
  const key = rawKey.trim();

  if (type === "CPF") {
    const digits = onlyDigits(key);
    return digits.length === 11 ? digits : null;
  }

  if (type === "CNPJ") {
    const digits = onlyDigits(key);
    return digits.length === 14 ? digits : null;
  }

  if (type === "PHONE") {
    const digits = onlyDigits(key);
    if (digits.length === 11) return `+55${digits}`;
    if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
    return null;
  }

  if (type === "EMAIL") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(key) ? key.toLowerCase() : null;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)
    ? key.toLowerCase()
    : null;
}

export function getOpenWithdrawal(userId: string) {
  return prisma.walletWithdrawal.findFirst({
    orderBy: { createdAt: "desc" },
    where: { status: { in: [...OPEN_STATUSES] }, userId }
  });
}

export async function requestWithdrawal(input: WithdrawalRequestInput) {
  return prisma.$transaction(
    async (tx) => {
      const pending = await tx.walletWithdrawal.findFirst({
        where: { status: { in: [...OPEN_STATUSES] }, userId: input.userId }
      });

      if (pending) throw new Error("WITHDRAWAL_ALREADY_PENDING");

      const withdrawal = await tx.walletWithdrawal.create({
        data: {
          amountCents: input.amountCents,
          pixKey: input.pixKey,
          pixKeyOwnerName: input.pixKeyOwnerName,
          pixKeyType: input.pixKeyType,
          userId: input.userId
        }
      });

      // O saldo sai agora para ninguem gastar duas vezes o mesmo dinheiro enquanto
      // o pedido espera aprovacao. Recusa e cancelamento devolvem.
      await debitWalletInTransaction(tx, {
        amountCents: input.amountCents,
        description: `Saque via Pix solicitado (${formatCents(input.amountCents)})`,
        relatedEntityId: withdrawal.id,
        type: "WITHDRAWAL",
        uniqueKey: `wallet:withdrawal:${withdrawal.id}`,
        userId: input.userId
      });

      await tx.auditLog.create({
        data: {
          action: "wallet.withdrawal.requested",
          entity: "WalletWithdrawal",
          entityId: withdrawal.id,
          userId: input.userId
        }
      });

      return withdrawal;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

async function refundWithdrawalInTransaction(
  tx: Prisma.TransactionClient,
  withdrawal: { amountCents: number; id: string; userId: string },
  reason: string
) {
  await creditWalletInTransaction(tx, {
    amountCents: withdrawal.amountCents,
    description: reason,
    relatedEntityId: withdrawal.id,
    type: "REFUND",
    uniqueKey: `wallet:withdrawal:refund:${withdrawal.id}`,
    userId: withdrawal.userId
  });
}

export async function cancelWithdrawal(input: { userId: string; withdrawalId: string }) {
  return prisma.$transaction(
    async (tx) => {
      const withdrawal = await tx.walletWithdrawal.findFirst({
        where: { id: input.withdrawalId, userId: input.userId }
      });

      if (!withdrawal) throw new Error("WITHDRAWAL_NOT_FOUND");
      // Depois de aprovado o admin ja pode ter feito o Pix, entao so o proprio admin desfaz.
      if (withdrawal.status !== "REQUESTED") throw new Error("WITHDRAWAL_NOT_CANCELLABLE");

      await refundWithdrawalInTransaction(tx, withdrawal, "Estorno de saque cancelado");
      await tx.auditLog.create({
        data: {
          action: "wallet.withdrawal.cancelled",
          entity: "WalletWithdrawal",
          entityId: withdrawal.id,
          userId: input.userId
        }
      });

      return tx.walletWithdrawal.update({
        data: { status: "CANCELLED" },
        where: { id: withdrawal.id }
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function approveWithdrawal(input: { adminId: string; withdrawalId: string }) {
  const withdrawal = await prisma.walletWithdrawal.findUnique({
    where: { id: input.withdrawalId }
  });

  if (!withdrawal) throw new Error("WITHDRAWAL_NOT_FOUND");
  if (withdrawal.status !== "REQUESTED") throw new Error("WITHDRAWAL_NOT_REVIEWABLE");

  const now = serverNow();
  const [updated] = await prisma.$transaction([
    prisma.walletWithdrawal.update({
      data: { reviewedAt: now, reviewedById: input.adminId, status: "APPROVED" },
      where: { id: withdrawal.id }
    }),
    prisma.notification.upsert({
      create: {
        body: `Seu saque de ${formatCents(withdrawal.amountCents)} foi aprovado e sera enviado para a sua chave Pix.`,
        icon: "wallet",
        message: `Seu saque de ${formatCents(withdrawal.amountCents)} foi aprovado e sera enviado para a sua chave Pix.`,
        relatedEntityId: withdrawal.id,
        title: "Saque aprovado",
        type: "PAYMENT",
        uniqueKey: `wallet:withdrawal:approved:${withdrawal.id}`,
        userId: withdrawal.userId
      },
      update: {},
      where: { uniqueKey: `wallet:withdrawal:approved:${withdrawal.id}` }
    }),
    prisma.auditLog.create({
      data: {
        action: "wallet.withdrawal.approved",
        entity: "WalletWithdrawal",
        entityId: withdrawal.id,
        userId: input.adminId
      }
    })
  ]);

  return updated;
}

export async function markWithdrawalPaid(input: {
  adminId: string;
  receiptRef?: string;
  withdrawalId: string;
}) {
  const withdrawal = await prisma.walletWithdrawal.findUnique({
    where: { id: input.withdrawalId }
  });

  if (!withdrawal) throw new Error("WITHDRAWAL_NOT_FOUND");
  if (withdrawal.status !== "APPROVED") throw new Error("WITHDRAWAL_NOT_PAYABLE");

  const now = serverNow();
  const [updated] = await prisma.$transaction([
    prisma.walletWithdrawal.update({
      data: {
        paidAt: now,
        receiptRef: input.receiptRef?.trim() || null,
        reviewedById: input.adminId,
        status: "PAID"
      },
      where: { id: withdrawal.id }
    }),
    prisma.notification.upsert({
      create: {
        body: `O Pix de ${formatCents(withdrawal.amountCents)} foi enviado para a sua chave.`,
        icon: "wallet",
        message: `O Pix de ${formatCents(withdrawal.amountCents)} foi enviado para a sua chave.`,
        relatedEntityId: withdrawal.id,
        title: "Saque pago",
        type: "PAYMENT",
        uniqueKey: `wallet:withdrawal:paid:${withdrawal.id}`,
        userId: withdrawal.userId
      },
      update: {},
      where: { uniqueKey: `wallet:withdrawal:paid:${withdrawal.id}` }
    }),
    prisma.auditLog.create({
      data: {
        action: "wallet.withdrawal.paid",
        entity: "WalletWithdrawal",
        entityId: withdrawal.id,
        userId: input.adminId
      }
    })
  ]);

  return updated;
}

export async function rejectWithdrawal(input: {
  adminId: string;
  reason: string;
  withdrawalId: string;
}) {
  return prisma.$transaction(
    async (tx) => {
      const withdrawal = await tx.walletWithdrawal.findUnique({
        where: { id: input.withdrawalId }
      });

      if (!withdrawal) throw new Error("WITHDRAWAL_NOT_FOUND");
      if (withdrawal.status !== "REQUESTED" && withdrawal.status !== "APPROVED") {
        throw new Error("WITHDRAWAL_NOT_REVIEWABLE");
      }

      await refundWithdrawalInTransaction(tx, withdrawal, "Estorno de saque recusado");

      const now = serverNow();
      await tx.notification.upsert({
        create: {
          body: `Seu saque de ${formatCents(withdrawal.amountCents)} nao foi aprovado e o valor voltou para a carteira. Motivo: ${input.reason}`,
          icon: "wallet",
          message: `Seu saque de ${formatCents(withdrawal.amountCents)} nao foi aprovado e o valor voltou para a carteira.`,
          relatedEntityId: withdrawal.id,
          title: "Saque recusado",
          type: "PAYMENT",
          uniqueKey: `wallet:withdrawal:rejected:${withdrawal.id}`,
          userId: withdrawal.userId
        },
        update: {},
        where: { uniqueKey: `wallet:withdrawal:rejected:${withdrawal.id}` }
      });

      await tx.auditLog.create({
        data: {
          action: "wallet.withdrawal.rejected",
          entity: "WalletWithdrawal",
          entityId: withdrawal.id,
          userId: input.adminId
        }
      });

      return tx.walletWithdrawal.update({
        data: {
          adminNote: input.reason,
          reviewedAt: now,
          reviewedById: input.adminId,
          status: "REJECTED"
        },
        where: { id: withdrawal.id }
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
