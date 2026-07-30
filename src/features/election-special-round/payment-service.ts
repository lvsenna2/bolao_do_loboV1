import type { PaymentStatus, Prisma } from "@prisma/client";

import { formatDateTimeInSaoPaulo, serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import {
  createMercadoPagoPixPayment,
  getMercadoPagoPixData,
  type MercadoPagoPayment
} from "@/server/mercado-pago/client";

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

function amountMatches(remote: number | null | undefined, local: Prisma.Decimal) {
  return typeof remote === "number" && Math.abs(remote - local.toNumber()) < 0.01;
}

export async function createElectionPix(input: {
  entryId: string;
  payerEmail: string;
  roundName: string;
}) {
  const entry = await prisma.electionEntry.findUniqueOrThrow({
    select: { amount: true, id: true },
    where: { id: input.entryId }
  });
  const expiresAt = new Date(serverNow().getTime() + PIX_EXPIRATION_HOURS * 60 * 60 * 1000);
  const provider = await createMercadoPagoPixPayment({
    amount: Number(entry.amount),
    description: `Rodada Especial: ${input.roundName}`,
    expiresAt,
    idempotencyKey: `election:${entry.id}`,
    internalPaymentId: entry.id,
    payerEmail: input.payerEmail
  });
  const pix = getMercadoPagoPixData(provider);
  const updated = await prisma.electionEntry.update({
    data: {
      paymentExpiresAt: pix.expiresAt ?? expiresAt,
      providerStatus: pix.providerStatus,
      providerStatusDetail: pix.providerStatusDetail,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: pix.ticketUrl,
      transactionId: pix.providerPaymentId
    },
    where: { id: entry.id }
  });

  return {
    amountLabel: new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" }).format(
      Number(updated.amount)
    ),
    expiresAtLabel: updated.paymentExpiresAt
      ? formatDateTimeInSaoPaulo(updated.paymentExpiresAt)
      : undefined,
    paymentId: updated.id,
    pixCode: updated.qrCode!,
    qrCodeDataUri: `data:image/png;base64,${updated.qrCodeBase64}`,
    ticketUrl: updated.ticketUrl,
    transactionId: updated.transactionId!
  };
}

export async function reconcileElectionPayment(provider: MercadoPagoPayment) {
  const providerId = String(provider.id);
  const reference = provider.external_reference ?? "";
  const entry = await prisma.electionEntry.findFirst({
    include: { round: { select: { id: true, name: true } } },
    where: {
      OR: [{ transactionId: providerId }, ...(reference ? [{ id: reference }] : [])]
    }
  });

  if (!entry) return null;
  if (reference !== entry.id || !amountMatches(provider.transaction_amount, entry.amount)) {
    throw new Error("MERCADO_PAGO_ELECTION_PAYMENT_MISMATCH");
  }

  const status = mapStatus(provider.status);
  const now = serverNow();
  await prisma.$transaction(async (tx) => {
    await tx.electionEntry.update({
      data: {
        confirmedAt: status === "APPROVED" ? now : entry.confirmedAt,
        lastWebhookAt: now,
        paymentStatus: status,
        providerStatus: provider.status ?? null,
        providerStatusDetail: provider.status_detail ?? null,
        refundedAt: status === "REFUNDED" ? now : entry.refundedAt,
        transactionId: providerId
      },
      where: { id: entry.id }
    });
    if (status === "APPROVED") {
      await tx.notification.upsert({
        create: {
          body: `Sua inscrição em ${entry.round.name} foi confirmada.`,
          icon: "election-paid",
          message: `Sua inscrição em ${entry.round.name} foi confirmada.`,
          relatedEntityId: entry.round.id,
          title: "Inscrição confirmada",
          type: "SPECIAL_ROUND",
          uniqueKey: `election:entry-approved:${entry.id}`,
          userId: entry.userId
        },
        update: {},
        where: { uniqueKey: `election:entry-approved:${entry.id}` }
      });
    }
  });

  return { paymentId: entry.id, status };
}
