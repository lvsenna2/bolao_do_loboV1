import type { Prisma, SubscriptionStatus } from "@prisma/client";

import { formatDateTimeInSaoPaulo, serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import {
  createMercadoPagoPixPayment,
  createMercadoPagoSubscription,
  getMercadoPagoAuthorizedPayment,
  getMercadoPagoPayment,
  getMercadoPagoPixData,
  getMercadoPagoSubscription,
  type MercadoPagoPayment,
  type MercadoPagoPreapproval
} from "@/server/mercado-pago/client";
import { getPlanConfig } from "./config";
import type { SubscriptionPixView } from "./types";

const PIX_EXPIRATION_HOURS = 24;

function money(value: Prisma.Decimal | number) {
  return Number(value).toLocaleString("pt-BR", { currency: "BRL", style: "currency" });
}

function amountsMatch(remote: number | string | null | undefined, local: Prisma.Decimal) {
  const amount = Number(remote);
  return Number.isFinite(amount) && Math.abs(amount - local.toNumber()) < 0.01;
}

export function addBillingMonth(value: Date) {
  const result = new Date(value);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

export function toSubscriptionPixView(subscription: {
  amount: Prisma.Decimal;
  id: string;
  paymentExpiresAt: Date | null;
  providerPaymentId: string | null;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
}): SubscriptionPixView | null {
  if (!subscription.providerPaymentId || !subscription.qrCode || !subscription.qrCodeBase64) {
    return null;
  }
  return {
    amountLabel: money(subscription.amount),
    expiresAtLabel: subscription.paymentExpiresAt
      ? formatDateTimeInSaoPaulo(subscription.paymentExpiresAt)
      : undefined,
    paymentId: subscription.id,
    pixCode: subscription.qrCode,
    qrCodeDataUri: `data:image/png;base64,${subscription.qrCodeBase64}`,
    ticketUrl: subscription.ticketUrl,
    transactionId: subscription.providerPaymentId
  };
}

export async function createSubscriptionPix(subscriptionId: string, payerEmail: string) {
  const subscription = await prisma.subscription.findUniqueOrThrow({
    where: { id: subscriptionId }
  });
  const expiresAt = new Date(serverNow().getTime() + PIX_EXPIRATION_HOURS * 60 * 60 * 1000);
  const provider = await createMercadoPagoPixPayment({
    amount: Number(subscription.amount),
    description: `Plano ${getPlanConfig(subscription.plan).name} - Bolao do Lobo`,
    expiresAt,
    idempotencyKey: `subscription-pix:${subscription.checkoutKey ?? subscription.id}`,
    internalPaymentId: subscription.id,
    payerEmail
  });
  const pix = getMercadoPagoPixData(provider);
  const updated = await prisma.subscription.update({
    data: {
      paymentExpiresAt: pix.expiresAt ?? expiresAt,
      providerPaymentId: pix.providerPaymentId,
      providerStatus: pix.providerStatus,
      providerStatusDetail: pix.providerStatusDetail,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: pix.ticketUrl
    },
    where: { id: subscription.id }
  });
  return toSubscriptionPixView(updated)!;
}

export async function createCardSubscriptionCheckout(subscriptionId: string, payerEmail: string) {
  const subscription = await prisma.subscription.findUniqueOrThrow({
    where: { id: subscriptionId }
  });
  const provider = await createMercadoPagoSubscription({
    amount: Number(subscription.amount),
    description: `Plano ${getPlanConfig(subscription.plan).name} - Bolao do Lobo`,
    idempotencyKey: `subscription-card:${subscription.checkoutKey ?? subscription.id}`,
    internalSubscriptionId: subscription.id,
    payerEmail
  });
  if (!provider.init_point) throw new Error("MERCADO_PAGO_SUBSCRIPTION_CHECKOUT_MISSING");
  await prisma.subscription.update({
    data: {
      checkoutUrl: provider.init_point,
      providerCustomerId: provider.payer_id ? String(provider.payer_id) : null,
      providerStatus: provider.status ?? "pending",
      providerSubscriptionId: String(provider.id)
    },
    where: { id: subscription.id }
  });
  return provider.init_point;
}

function paymentStatus(status?: string | null): SubscriptionStatus {
  switch (status) {
    case "approved":
      return "ACTIVE";
    case "refunded":
    case "charged_back":
      return "REFUNDED";
    case "rejected":
      return "PAST_DUE";
    case "cancelled":
    case "canceled":
      return "CANCELED";
    default:
      return "PENDING";
  }
}

export async function reconcileSubscriptionPayment(
  provider: MercadoPagoPayment,
  subscriptionIdHint?: string
) {
  const providerId = String(provider.id);
  const reference = provider.external_reference ?? "";
  const subscription = await prisma.subscription.findFirst({
    where: {
      OR: [
        { providerPaymentId: providerId },
        ...(subscriptionIdHint ? [{ id: subscriptionIdHint }] : []),
        ...(/^[0-9a-f-]{36}$/i.test(reference) ? [{ id: reference }] : [])
      ]
    }
  });
  if (!subscription) return null;
  if (
    (reference && reference !== subscription.id) ||
    !amountsMatch(provider.transaction_amount, subscription.amount)
  ) {
    throw new Error("MERCADO_PAGO_SUBSCRIPTION_PAYMENT_MISMATCH");
  }

  const status = paymentStatus(provider.status);
  const uniqueKey = `subscription:payment:${providerId}:${provider.status ?? "unknown"}`;
  const now = serverNow();
  await prisma.$transaction(async (tx) => {
    const duplicate = await tx.subscriptionEvent.findUnique({ where: { uniqueKey } });
    if (duplicate) return;

    const base =
      subscription.currentPeriodEnd && subscription.currentPeriodEnd > now
        ? subscription.currentPeriodEnd
        : now;
    const activates = status === "ACTIVE";
    await tx.subscription.update({
      data: {
        currentPeriodEnd: activates ? addBillingMonth(base) : undefined,
        currentPeriodStart: activates ? base : undefined,
        lastWebhookAt: now,
        providerPaymentId: providerId,
        providerStatus: provider.status ?? null,
        providerStatusDetail: provider.status_detail ?? null,
        startedAt: activates ? (subscription.startedAt ?? now) : undefined,
        status
      },
      where: { id: subscription.id }
    });
    await tx.subscriptionEvent.create({
      data: {
        metadata: {
          providerStatus: provider.status ?? null,
          providerStatusDetail: provider.status_detail ?? null
        },
        providerResourceId: providerId,
        status,
        subscriptionId: subscription.id,
        type: activates ? "PAYMENT_APPROVED" : "PAYMENT_UPDATED",
        uniqueKey
      }
    });
    if (activates) {
      await tx.notification.upsert({
        create: {
          body: `Seu plano ${getPlanConfig(subscription.plan).name} esta ativo ate ${formatDateTimeInSaoPaulo(addBillingMonth(base))}.`,
          icon: "subscription",
          message: "Pagamento confirmado e beneficios liberados.",
          relatedEntityId: subscription.id,
          title: "Assinatura ativada",
          type: "PAYMENT",
          uniqueKey: `subscription:activated:${providerId}`,
          userId: subscription.userId
        },
        update: {},
        where: { uniqueKey: `subscription:activated:${providerId}` }
      });
    }
  });
  return { paymentId: subscription.id, status };
}

function preapprovalStatus(status?: string | null): SubscriptionStatus {
  switch (status) {
    case "authorized":
      return "PENDING";
    case "paused":
      return "PAST_DUE";
    case "cancelled":
    case "canceled":
      return "CANCELED";
    default:
      return "PENDING";
  }
}

export async function reconcileSubscriptionPreapproval(provider: MercadoPagoPreapproval) {
  const reference = provider.external_reference ?? "";
  const subscription = await prisma.subscription.findFirst({
    where: {
      OR: [
        { providerSubscriptionId: String(provider.id) },
        ...(/^[0-9a-f-]{36}$/i.test(reference) ? [{ id: reference }] : [])
      ]
    }
  });
  if (!subscription) return null;
  if (
    (reference && reference !== subscription.id) ||
    !amountsMatch(provider.auto_recurring?.transaction_amount, subscription.amount)
  ) {
    throw new Error("MERCADO_PAGO_SUBSCRIPTION_MISMATCH");
  }
  const mapped = preapprovalStatus(provider.status);
  const now = serverNow();
  const uniqueKey = `subscription:preapproval:${provider.id}:${provider.status ?? "unknown"}`;
  await prisma.$transaction(async (tx) => {
    await tx.subscriptionEvent.upsert({
      create: {
        providerResourceId: String(provider.id),
        status: mapped,
        subscriptionId: subscription.id,
        type: "PREAPPROVAL_UPDATED",
        uniqueKey
      },
      update: {},
      where: { uniqueKey }
    });
    await tx.subscription.update({
      data: {
        canceledAt: mapped === "CANCELED" ? (subscription.canceledAt ?? now) : undefined,
        checkoutUrl: provider.init_point ?? subscription.checkoutUrl,
        lastWebhookAt: now,
        providerCustomerId: provider.payer_id ? String(provider.payer_id) : undefined,
        providerStatus: provider.status ?? null,
        providerSubscriptionId: String(provider.id),
        status: mapped === "PENDING" && subscription.status === "ACTIVE" ? "ACTIVE" : mapped
      },
      where: { id: subscription.id }
    });
  });
  return { status: mapped, subscriptionId: subscription.id };
}

export async function reconcileSubscriptionPreapprovalById(providerId: string) {
  return reconcileSubscriptionPreapproval(await getMercadoPagoSubscription(providerId));
}

export async function reconcileSubscriptionAuthorizedPaymentById(providerId: string) {
  const invoice = await getMercadoPagoAuthorizedPayment(providerId);
  if (!invoice.payment?.id) return { ignored: true, status: invoice.status ?? "unknown" };
  const identifiers: Prisma.SubscriptionWhereInput[] = [
    ...(invoice.preapproval_id ? [{ providerSubscriptionId: String(invoice.preapproval_id) }] : []),
    ...(/^[0-9a-f-]{36}$/i.test(invoice.external_reference ?? "")
      ? [{ id: invoice.external_reference! }]
      : [])
  ];
  if (identifiers.length === 0) return null;
  const subscription = await prisma.subscription.findFirst({
    select: { id: true },
    where: { OR: identifiers }
  });
  if (!subscription) return null;
  const payment = await getMercadoPagoPayment(String(invoice.payment.id));
  return reconcileSubscriptionPayment(payment, subscription.id);
}
