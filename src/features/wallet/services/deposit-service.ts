import { Prisma, type PaymentStatus } from "@prisma/client";

import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import {
  createMercadoPagoPixPayment,
  getMercadoPagoPixData,
  type MercadoPagoPayment
} from "@/server/mercado-pago/client";
import { creditWalletInTransaction, reverseWalletCreditInTransaction } from "./wallet-service";

const PIX_EXPIRATION_HOURS = 24;

function mapStatus(status?: string | null): PaymentStatus {
  if (status === "approved") return "APPROVED";
  if (status === "refunded" || status === "charged_back") return "REFUNDED";
  if (status === "cancelled") return "CANCELLED";
  if (status === "rejected") return "FAILED";
  return "PENDING";
}

export async function createWalletDepositPix(input: {
  amountCents: number;
  depositId: string;
  payerEmail: string;
}) {
  const expiresAt = new Date(serverNow().getTime() + PIX_EXPIRATION_HOURS * 3_600_000);
  const provider = await createMercadoPagoPixPayment({
    amount: input.amountCents / 100,
    description: "Adicionar saldo - Bolao do Lobo",
    expiresAt,
    idempotencyKey: input.depositId,
    internalPaymentId: input.depositId,
    payerEmail: input.payerEmail
  });
  const pix = getMercadoPagoPixData(provider);

  return prisma.walletDeposit.update({
    data: {
      expiresAt: pix.expiresAt ?? expiresAt,
      providerStatus: pix.providerStatus,
      providerStatusDetail: pix.providerStatusDetail,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: pix.ticketUrl,
      transactionId: pix.providerPaymentId
    },
    where: { id: input.depositId }
  });
}

export async function reconcileWalletDepositPayment(provider: MercadoPagoPayment) {
  const providerId = String(provider.id);
  const reference = provider.external_reference ?? "";
  const deposit = await prisma.walletDeposit.findFirst({
    where: { OR: [{ transactionId: providerId }, { id: reference }] }
  });
  if (!deposit) return null;
  const remoteCents = Math.round((provider.transaction_amount ?? -1) * 100);
  if (reference !== deposit.id || remoteCents !== deposit.amountCents) {
    throw new Error("MERCADO_PAGO_WALLET_DEPOSIT_MISMATCH");
  }

  const status = mapStatus(provider.status);
  const wasApproved = deposit.status === "APPROVED";
  const now = serverNow();
  await prisma.$transaction(
    async (tx) => {
      await tx.walletDeposit.update({
        data: {
          lastWebhookAt: now,
          paidAt: status === "APPROVED" ? now : deposit.paidAt,
          providerStatus: provider.status ?? null,
          providerStatusDetail: provider.status_detail ?? null,
          status,
          transactionId: providerId
        },
        where: { id: deposit.id }
      });
      if (status === "APPROVED") {
        await creditWalletInTransaction(tx, {
          amountCents: deposit.amountCents,
          description: "Deposito via Pix",
          relatedEntityId: deposit.id,
          type: "DEPOSIT",
          uniqueKey: `wallet:deposit:${deposit.id}`,
          userId: deposit.userId
        });
        await tx.notification.upsert({
          create: {
            body: "Seu deposito foi confirmado e o saldo ja esta disponivel.",
            icon: "wallet",
            message: "Seu deposito foi confirmado e o saldo ja esta disponivel.",
            relatedEntityId: deposit.id,
            title: "Saldo adicionado",
            type: "PAYMENT",
            uniqueKey: `wallet:deposit:notification:${deposit.id}`,
            userId: deposit.userId
          },
          update: {},
          where: { uniqueKey: `wallet:deposit:notification:${deposit.id}` }
        });
      }
      if (status === "REFUNDED" && wasApproved) {
        await reverseWalletCreditInTransaction(tx, {
          amountCents: deposit.amountCents,
          description: "Estorno de deposito via Pix",
          relatedEntityId: deposit.id,
          type: "REFUND",
          uniqueKey: `wallet:deposit:refund:${deposit.id}`,
          userId: deposit.userId
        });
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
  return { paymentId: deposit.id, status };
}
