import type { PaymentStatus, Prisma } from "@prisma/client";

import { formatDateTimeInSaoPaulo, serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import {
  createMercadoPagoPixPayment,
  getMercadoPagoPixData,
  type MercadoPagoPayment
} from "@/server/mercado-pago/client";
import type { ApiFundingPaymentView } from "./types";

const PIX_EXPIRATION_HOURS = 24;

function mapStatus(status?: string | null): PaymentStatus {
  switch (status) {
    case "approved":
      return "APPROVED";
    case "refunded":
    case "charged_back":
      return "REFUNDED";
    case "cancelled":
      return "CANCELLED";
    case "rejected":
      return "FAILED";
    default:
      return "PENDING";
  }
}

function amountsMatch(remote: number | null | undefined, local: Prisma.Decimal) {
  return typeof remote === "number" && Math.abs(remote - local.toNumber()) < 0.01;
}

export function toApiFundingPaymentView(contribution: {
  amount: Prisma.Decimal;
  id: string;
  paymentExpiresAt: Date | null;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  transactionId: string | null;
}): ApiFundingPaymentView | null {
  if (!contribution.qrCode || !contribution.qrCodeBase64 || !contribution.transactionId) {
    return null;
  }

  return {
    amountLabel: Number(contribution.amount).toLocaleString("pt-BR", {
      currency: "BRL",
      style: "currency"
    }),
    expiresAtLabel: contribution.paymentExpiresAt
      ? formatDateTimeInSaoPaulo(contribution.paymentExpiresAt)
      : undefined,
    paymentId: contribution.id,
    pixCode: contribution.qrCode,
    qrCodeDataUri: `data:image/png;base64,${contribution.qrCodeBase64}`,
    ticketUrl: contribution.ticketUrl,
    transactionId: contribution.transactionId
  };
}

export async function createApiFundingPix(input: {
  contributionId: string;
  payerEmail: string;
}) {
  const contribution = await prisma.apiFundingContribution.findUniqueOrThrow({
    select: { amount: true, id: true },
    where: { id: input.contributionId }
  });
  const expiresAt = new Date(serverNow().getTime() + PIX_EXPIRATION_HOURS * 60 * 60 * 1000);
  const provider = await createMercadoPagoPixPayment({
    amount: Number(contribution.amount),
    description: "Contribuicao para manutencao da API - Bolao do Lobo",
    expiresAt,
    idempotencyKey: `api-funding:${contribution.id}`,
    internalPaymentId: contribution.id,
    payerEmail: input.payerEmail
  });
  const pix = getMercadoPagoPixData(provider);
  const updated = await prisma.apiFundingContribution.update({
    data: {
      paymentExpiresAt: pix.expiresAt ?? expiresAt,
      providerStatus: pix.providerStatus,
      providerStatusDetail: pix.providerStatusDetail,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: pix.ticketUrl,
      transactionId: pix.providerPaymentId
    },
    where: { id: contribution.id }
  });

  return toApiFundingPaymentView(updated)!;
}

export async function reconcileApiFundingPayment(provider: MercadoPagoPayment) {
  const providerId = String(provider.id);
  const reference = provider.external_reference ?? "";
  const contribution = await prisma.apiFundingContribution.findFirst({
    where: {
      OR: [{ transactionId: providerId }, ...(reference ? [{ id: reference }] : [])]
    }
  });

  if (!contribution) return null;
  if (reference !== contribution.id || !amountsMatch(provider.transaction_amount, contribution.amount)) {
    throw new Error("MERCADO_PAGO_API_FUNDING_MISMATCH");
  }

  const status = mapStatus(provider.status);
  const now = serverNow();
  const pixData = provider.point_of_interaction?.transaction_data;

  await prisma.$transaction(async (tx) => {
    await tx.apiFundingContribution.update({
      data: {
        lastWebhookAt: now,
        paidAt: status === "APPROVED" ? contribution.paidAt ?? now : contribution.paidAt,
        providerStatus: provider.status ?? null,
        providerStatusDetail: provider.status_detail ?? null,
        ...(pixData?.qr_code ? { qrCode: pixData.qr_code } : {}),
        ...(pixData?.qr_code_base64 ? { qrCodeBase64: pixData.qr_code_base64 } : {}),
        ...(pixData?.ticket_url ? { ticketUrl: pixData.ticket_url } : {}),
        refundedAt: status === "REFUNDED" ? contribution.refundedAt ?? now : contribution.refundedAt,
        status,
        transactionId: providerId
      },
      where: { id: contribution.id }
    });

    if (status === "APPROVED") {
      await tx.notification.upsert({
        create: {
          body: `Sua contribuicao de ${Number(contribution.amount).toLocaleString("pt-BR", {
            currency: "BRL",
            style: "currency"
          })} para a manutencao da API foi confirmada. Obrigado pelo apoio!`,
          icon: "api-funding",
          message: "Sua contribuicao para a manutencao da API foi confirmada.",
          relatedEntityId: contribution.id,
          title: "Contribuicao confirmada",
          type: "PAYMENT",
          uniqueKey: `api-funding:approved:${contribution.id}`,
          userId: contribution.userId
        },
        update: {},
        where: { uniqueKey: `api-funding:approved:${contribution.id}` }
      });
    }
  });

  return { paymentId: contribution.id, status };
}
