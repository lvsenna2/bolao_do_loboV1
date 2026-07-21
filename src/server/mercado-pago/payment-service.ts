import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentStatus, Prisma } from "@prisma/client";

import {
  evaluateAchievementsForUser,
  syncActiveLeagueMissionProgress
} from "@/features/xp/services/xp-service";
import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import {
  createMercadoPagoPixPayment,
  getMercadoPagoPayment,
  getMercadoPagoPixData,
  type MercadoPagoPayment
} from "./client";

const PIX_EXPIRATION_HOURS = 24;

export type MercadoPagoPaymentIntent = {
  amount: Prisma.Decimal;
  expiresAt: Date | null;
  id: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string | null;
  transactionId: string;
};

export function mapMercadoPagoStatus(status?: string | null): PaymentStatus {
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

export async function createDynamicPixForPayment(input: {
  amount: number;
  description: string;
  payerEmail: string;
  paymentId: string;
}) {
  const expiresAt = new Date(serverNow().getTime() + PIX_EXPIRATION_HOURS * 60 * 60 * 1000);
  const providerPayment = await createMercadoPagoPixPayment({
    amount: input.amount,
    description: input.description,
    expiresAt,
    idempotencyKey: input.paymentId,
    internalPaymentId: input.paymentId,
    payerEmail: input.payerEmail
  });
  const pix = getMercadoPagoPixData(providerPayment);

  return prisma.payment.update({
    data: {
      expiresAt: pix.expiresAt ?? expiresAt,
      gateway: "MERCADO_PAGO",
      providerStatus: pix.providerStatus,
      providerStatusDetail: pix.providerStatusDetail,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      receiptUrl: pix.ticketUrl,
      status: mapMercadoPagoStatus(pix.providerStatus),
      ticketUrl: pix.ticketUrl,
      transactionId: pix.providerPaymentId
    },
    select: {
      amount: true,
      expiresAt: true,
      id: true,
      qrCode: true,
      qrCodeBase64: true,
      ticketUrl: true,
      transactionId: true
    },
    where: { id: input.paymentId }
  });
}

function amountsMatch(remote: number | null | undefined, local: Prisma.Decimal) {
  return typeof remote === "number" && Math.abs(remote - local.toNumber()) < 0.01;
}

export async function reconcileMercadoPagoPayment(providerPayment: MercadoPagoPayment) {
  const providerPaymentId = String(providerPayment.id);
  const externalReference = providerPayment.external_reference ?? "";
  const isInternalPaymentId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      externalReference
    );
  const payment = await prisma.payment.findFirst({
    select: {
      amount: true,
      id: true,
      leagueId: true,
      status: true,
      userId: true
    },
    where: {
      OR: [
        { transactionId: providerPaymentId },
        ...(isInternalPaymentId ? [{ id: externalReference }] : [])
      ]
    }
  });

  if (
    !payment ||
    externalReference !== payment.id ||
    !amountsMatch(providerPayment.transaction_amount, payment.amount)
  ) {
    throw new Error("MERCADO_PAGO_PAYMENT_MISMATCH");
  }

  const nextStatus = mapMercadoPagoStatus(providerPayment.status);
  const now = serverNow();
  const wasApproved = payment.status === "APPROVED";
  const pixData = providerPayment.point_of_interaction?.transaction_data;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      data: {
        checkoutKey:
          nextStatus === "FAILED" || nextStatus === "CANCELLED" || nextStatus === "REFUNDED"
            ? null
            : undefined,
        lastWebhookAt: now,
        paidAt: nextStatus === "APPROVED" ? now : payment.status === "APPROVED" ? undefined : null,
        providerStatus: providerPayment.status ?? null,
        providerStatusDetail: providerPayment.status_detail ?? null,
        ...(pixData?.qr_code ? { qrCode: pixData.qr_code } : {}),
        ...(pixData?.qr_code_base64 ? { qrCodeBase64: pixData.qr_code_base64 } : {}),
        ...(pixData?.ticket_url
          ? { receiptUrl: pixData.ticket_url, ticketUrl: pixData.ticket_url }
          : {}),
        status: nextStatus,
        transactionId: providerPaymentId
      },
      where: { id: payment.id }
    });

    if (nextStatus === "APPROVED") {
      await tx.leagueMember.upsert({
        create: {
          leagueId: payment.leagueId,
          role: "MEMBER",
          status: "ACTIVE",
          userId: payment.userId
        },
        update: {
          joinedAt: now,
          leftAt: null,
          status: "ACTIVE"
        },
        where: {
          leagueId_userId: { leagueId: payment.leagueId, userId: payment.userId }
        }
      });

      await tx.notification.upsert({
        create: {
          body: "Pagamento confirmado. Sua entrada na liga foi liberada.",
          icon: "payment-approved",
          message: "Pagamento confirmado. Sua entrada na liga foi liberada.",
          relatedEntityId: payment.id,
          title: "Pagamento aprovado",
          type: "PAYMENT",
          uniqueKey: `payment:approved:${payment.id}`,
          userId: payment.userId
        },
        update: {},
        where: { uniqueKey: `payment:approved:${payment.id}` }
      });
    }
  });

  if (nextStatus === "APPROVED" && !wasApproved) {
    await Promise.all([
      syncActiveLeagueMissionProgress(payment.userId),
      evaluateAchievementsForUser(payment.userId)
    ]);
  }

  return { paymentId: payment.id, status: nextStatus };
}

export async function reconcileMercadoPagoPaymentById(providerPaymentId: string) {
  const providerPayment = await getMercadoPagoPayment(providerPaymentId);
  return reconcileMercadoPagoPayment(providerPayment);
}

function parseSignature(signature: string) {
  return Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, value] = part.trim().split("=", 2);
      return [key, value];
    })
  );
}

export function validateMercadoPagoWebhookSignature(input: {
  dataId: string;
  requestId: string;
  signature: string;
  secret: string;
}) {
  const parts = parseSignature(input.signature);

  if (!parts.ts || !parts.v1) {
    return false;
  }

  const normalizedDataId = input.dataId.toLowerCase();
  const manifest = `id:${normalizedDataId};request-id:${input.requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", input.secret).update(manifest).digest("hex");
  const provided = parts.v1;

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
