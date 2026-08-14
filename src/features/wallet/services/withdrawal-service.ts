import { Prisma, type PixKeyType } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import { getPixPayoutProvider, type PixPayoutResult } from "./pix-payout-provider";
import { creditWalletInTransaction, debitWalletInTransaction, formatCents } from "./wallet-service";

export const MIN_WITHDRAWAL_CENTS = 2_000;
export const MAX_WITHDRAWAL_CENTS = 500_000;

/** Enquanto um pedido esta nesses estados o dinheiro ja saiu da carteira e esta retido. */
const OPEN_STATUSES = ["REQUESTED", "APPROVED", "PIX_PROCESSING", "PIX_FAILED"] as const;

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
          // Nasce junto com o pedido e nunca muda: e ela que impede o provedor de Pix de
          // executar duas transferencias para o mesmo saque.
          payoutIdempotencyKey: `withdrawal:${randomUUID()}`,
          pixKey: input.pixKey,
          pixKeyOwnerName: input.pixKeyOwnerName,
          pixKeyType: input.pixKeyType,
          userId: input.userId
        }
      });

      // O saldo sai agora para ninguem gastar duas vezes o mesmo dinheiro enquanto
      // o pedido espera aprovacao. Recusa e cancelamento devolvem.
      // REAL_ONLY: saldo bonus nunca vira saque, nem quando o total daria.
      await debitWalletInTransaction(tx, {
        amountCents: input.amountCents,
        description: `Saque via Pix solicitado (${formatCents(input.amountCents)})`,
        relatedEntityId: withdrawal.id,
        source: "REAL_ONLY",
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
    bucket: "REAL",
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

/**
 * Aprova o saque e, se houver provedor de Pix de saida configurado, ja envia o Pix.
 *
 * A protecao contra Pix duplicado tem duas camadas: a transicao de status e feita com
 * `updateMany` filtrando pelo status anterior (dois cliques simultaneos, so um avanca) e a
 * chamada ao provedor leva a `payoutIdempotencyKey` fixa do saque, para o proprio PSP recusar
 * a segunda transferencia caso a primeira ja tenha saido.
 */
export async function approveWithdrawal(input: { adminId: string; withdrawalId: string }) {
  const withdrawal = await prisma.walletWithdrawal.findUnique({
    where: { id: input.withdrawalId }
  });

  if (!withdrawal) throw new Error("WITHDRAWAL_NOT_FOUND");
  if (withdrawal.status !== "REQUESTED") throw new Error("WITHDRAWAL_NOT_REVIEWABLE");

  const now = serverNow();
  const claimed = await prisma.walletWithdrawal.updateMany({
    data: {
      approvedAt: now,
      approvedById: input.adminId,
      reviewedAt: now,
      reviewedById: input.adminId,
      status: "APPROVED"
    },
    // Filtro pelo status anterior: quem chegar depois nao encontra a linha.
    where: { id: withdrawal.id, status: "REQUESTED" }
  });
  if (claimed.count !== 1) throw new Error("WITHDRAWAL_NOT_REVIEWABLE");

  await prisma.$transaction([
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

  return sendWithdrawalPix({ adminId: input.adminId, withdrawalId: withdrawal.id });
}

/**
 * Dispara o Pix de saida de um saque ja aprovado. Sem provedor configurado nao faz nada e o
 * saque continua em APPROVED, esperando o Pix manual — que e o comportamento de hoje.
 */
export async function sendWithdrawalPix(input: { adminId: string; withdrawalId: string }) {
  const provider = getPixPayoutProvider();
  const current = await prisma.walletWithdrawal.findUniqueOrThrow({
    where: { id: input.withdrawalId }
  });

  if (!provider) return current;
  if (!["APPROVED", "PIX_FAILED"].includes(current.status)) {
    throw new Error("WITHDRAWAL_NOT_PAYABLE");
  }

  const processing = await prisma.walletWithdrawal.updateMany({
    data: {
      transferAttemptedAt: serverNow(),
      transferError: null,
      transferProvider: provider.name,
      status: "PIX_PROCESSING"
    },
    where: { id: current.id, status: current.status }
  });
  // Outra requisicao ja pegou este saque: nao dispara um segundo Pix.
  if (processing.count !== 1) throw new Error("WITHDRAWAL_PIX_ALREADY_RUNNING");

  await prisma.auditLog.create({
    data: {
      action: "wallet.withdrawal.pix_requested",
      entity: "WalletWithdrawal",
      entityId: current.id,
      userId: input.adminId
    }
  });

  let result: PixPayoutResult;
  try {
    result = await provider.sendPix({
      amountCents: current.amountCents,
      idempotencyKey: current.payoutIdempotencyKey,
      pixKey: current.pixKey,
      pixKeyOwnerName: current.pixKeyOwnerName,
      pixKeyType: current.pixKeyType,
      withdrawalId: current.id
    });
  } catch (cause) {
    // Erro inesperado (rede, timeout): o saque para em PIX_FAILED com o dinheiro ainda retido,
    // nunca em "pago". Reenviar so pela acao de retentativa, que usa a mesma chave.
    console.error("[wallet] Falha inesperada no Pix de saida", cause);
    result = {
      error: cause instanceof Error ? cause.message : "Falha ao comunicar com o provedor de Pix.",
      ok: false
    };
  }

  return finishWithdrawalPix({ adminId: input.adminId, result, withdrawalId: current.id });
}

async function finishWithdrawalPix(input: {
  adminId: string;
  result: PixPayoutResult;
  withdrawalId: string;
}) {
  const now = serverNow();

  if (!input.result.ok) {
    const updated = await prisma.walletWithdrawal.update({
      data: {
        status: "PIX_FAILED",
        transferError: input.result.error.slice(0, 400),
        transferId: input.result.transferId ?? undefined,
        transferStatus: input.result.providerStatus ?? "failed"
      },
      where: { id: input.withdrawalId }
    });
    await prisma.auditLog.create({
      data: {
        action: "wallet.withdrawal.pix_failed",
        entity: "WalletWithdrawal",
        entityId: updated.id,
        userId: input.adminId
      }
    });
    return updated;
  }

  const updated = await prisma.walletWithdrawal.update({
    data: {
      paidAt: now,
      receiptRef: input.result.transferId,
      status: "PAID",
      transferId: input.result.transferId,
      transferStatus: input.result.providerStatus
    },
    where: { id: input.withdrawalId }
  });
  await prisma.$transaction([
    prisma.notification.upsert({
      create: {
        body: `O Pix de ${formatCents(updated.amountCents)} foi enviado para a sua chave.`,
        icon: "wallet",
        message: `O Pix de ${formatCents(updated.amountCents)} foi enviado para a sua chave.`,
        relatedEntityId: updated.id,
        title: "Saque pago",
        type: "PAYMENT",
        uniqueKey: `wallet:withdrawal:paid:${updated.id}`,
        userId: updated.userId
      },
      update: {},
      where: { uniqueKey: `wallet:withdrawal:paid:${updated.id}` }
    }),
    prisma.auditLog.create({
      data: {
        action: "wallet.withdrawal.pix_paid",
        entity: "WalletWithdrawal",
        entityId: updated.id,
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
  // PIX_FAILED tambem entra aqui: se o admin acabou fazendo o Pix por fora depois da falha,
  // ele consegue fechar o saque com o comprovante do banco.
  if (!["APPROVED", "PIX_FAILED"].includes(withdrawal.status)) {
    throw new Error("WITHDRAWAL_NOT_PAYABLE");
  }

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
      // PIX_PROCESSING fica de fora: enquanto o provedor nao responde nao da para saber se o
      // dinheiro saiu, e devolver o saldo agora arriscaria pagar duas vezes.
      if (!["REQUESTED", "APPROVED", "PIX_FAILED"].includes(withdrawal.status)) {
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
