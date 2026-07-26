import type { PaymentStatus, Prisma } from "@prisma/client";

import { formatDateTimeInSaoPaulo, serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import {
  createMercadoPagoPixPayment,
  getMercadoPagoPixData,
  type MercadoPagoPayment as ProviderPayment
} from "@/server/mercado-pago/client";

const PIX_EXPIRATION_HOURS = 24;

function mapSpecialPaymentStatus(status?: string | null): PaymentStatus {
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

export async function createSpecialRoundPix(input: {
  entryId: string;
  payerEmail: string;
  roundName: string;
}) {
  const entry = await prisma.specialRoundEntry.findUniqueOrThrow({
    select: { amount: true, id: true },
    where: { id: input.entryId }
  });
  const expiresAt = new Date(serverNow().getTime() + PIX_EXPIRATION_HOURS * 60 * 60 * 1000);
  const provider = await createMercadoPagoPixPayment({
    amount: Number(entry.amount),
    description: `Rodada Especial: ${input.roundName}`,
    expiresAt,
    idempotencyKey: entry.id,
    internalPaymentId: entry.id,
    payerEmail: input.payerEmail
  });
  const pix = getMercadoPagoPixData(provider);
  const updated = await prisma.specialRoundEntry.update({
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
    expiresAtLabel: formatDateTimeInSaoPaulo(updated.paymentExpiresAt),
    paymentId: updated.id,
    pixCode: updated.qrCode!,
    qrCodeDataUri: `data:image/png;base64,${updated.qrCodeBase64}`,
    ticketUrl: updated.ticketUrl,
    transactionId: updated.transactionId!
  };
}

export async function reconcileSpecialRoundPayment(provider: ProviderPayment) {
  const providerId = String(provider.id);
  const reference = provider.external_reference ?? "";
  const isInternalId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference);
  const entry = await prisma.specialRoundEntry.findFirst({
    include: { specialRound: { select: { id: true, name: true } } },
    where: {
      OR: [{ transactionId: providerId }, ...(isInternalId ? [{ id: reference }] : [])]
    }
  });

  if (
    !entry ||
    reference !== entry.id ||
    !amountMatches(provider.transaction_amount, entry.amount)
  ) {
    throw new Error("MERCADO_PAGO_SPECIAL_ROUND_PAYMENT_MISMATCH");
  }

  const status = mapSpecialPaymentStatus(provider.status);
  const now = serverNow();
  await prisma.$transaction(async (tx) => {
    await tx.specialRoundEntry.update({
      data: {
        confirmedAt: status === "APPROVED" ? now : entry.confirmedAt,
        lastWebhookAt: now,
        providerStatus: provider.status ?? null,
        providerStatusDetail: provider.status_detail ?? null,
        refundedAt: status === "REFUNDED" ? now : entry.refundedAt,
        paymentStatus: status,
        transactionId: providerId
      },
      where: { id: entry.id }
    });
    if (status === "APPROVED") {
      await tx.notification.upsert({
        create: {
          body: `Sua inscricao em ${entry.specialRound.name} foi confirmada.`,
          icon: "special-round-paid",
          message: `Sua inscricao em ${entry.specialRound.name} foi confirmada.`,
          relatedEntityId: entry.specialRound.id,
          title: "Inscricao confirmada",
          type: "SPECIAL_ROUND",
          uniqueKey: `special-round:entry-approved:${entry.id}`,
          userId: entry.userId
        },
        update: {},
        where: { uniqueKey: `special-round:entry-approved:${entry.id}` }
      });
    }
  });

  return { paymentId: entry.id, status };
}
