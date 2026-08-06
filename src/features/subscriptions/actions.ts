"use server";

import { revalidatePath } from "next/cache";

import { serverNow } from "@/lib/date-time";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import {
  cancelMercadoPagoSubscription,
  getMercadoPagoPayment,
  getMercadoPagoSubscription
} from "@/server/mercado-pago/client";
import { getPlanConfig } from "./config";
import {
  createCardSubscriptionCheckout,
  createSubscriptionPix,
  reconcileSubscriptionPayment,
  reconcileSubscriptionPreapproval,
  toSubscriptionPixView
} from "./payment-service";
import { startSubscriptionSchema, subscriptionIdSchema } from "./schemas";
import type { SubscriptionActionResult, SubscriptionCheckoutResult } from "./types";

function revalidateSubscriptionPaths() {
  revalidatePath("/planos");
  revalidatePath("/apoie-a-api");
  revalidatePath("/ligas");
  revalidatePath("/rodadas-especiais");
  revalidatePath("/notificacoes");
}

async function closeOpenSubscription(subscription: {
  id: string;
  paymentMethod: "PIX" | "CARD";
  providerSubscriptionId: string | null;
}) {
  if (subscription.paymentMethod === "CARD" && subscription.providerSubscriptionId) {
    await cancelMercadoPagoSubscription(subscription.providerSubscriptionId);
  }
  await prisma.subscription.update({
    data: { canceledAt: serverNow(), status: "CANCELED" },
    where: { id: subscription.id }
  });
}

export async function startSubscriptionAction(
  input: unknown
): Promise<SubscriptionActionResult<SubscriptionCheckoutResult>> {
  const user = await requireUser();
  const parsed = startSubscriptionSchema.safeParse(input);
  if (!parsed.success)
    return { message: "Selecione um plano e uma forma de pagamento.", ok: false };

  const config = getPlanConfig(parsed.data.plan);
  const payer = await prisma.user.findUnique({ select: { email: true }, where: { id: user.id } });
  if (!payer) return { message: "Usuario nao encontrado.", ok: false };

  const existing = await prisma.subscription.findFirst({
    orderBy: { createdAt: "desc" },
    where: { status: { in: ["PENDING", "ACTIVE", "PAST_DUE"] }, userId: user.id }
  });

  if (existing?.status === "ACTIVE" && existing.plan === parsed.data.plan) {
    return { message: `Seu plano ${config.name} ja esta ativo.`, ok: false };
  }

  if (
    existing?.status === "PENDING" &&
    existing.plan === parsed.data.plan &&
    existing.paymentMethod === parsed.data.paymentMethod
  ) {
    const payment = toSubscriptionPixView(existing);
    if (payment) {
      return {
        data: { payment, subscriptionId: existing.id },
        message: "Continue o pagamento Pix ja gerado.",
        ok: true
      };
    }
    if (existing.checkoutUrl) {
      return {
        data: { checkoutUrl: existing.checkoutUrl, subscriptionId: existing.id },
        message: "Continue no checkout seguro do Mercado Pago.",
        ok: true
      };
    }
  }

  try {
    if (existing) await closeOpenSubscription(existing);
    const checkoutKey = `subscription:${user.id}:${parsed.data.idempotencyKey}`;
    const subscription = await prisma.subscription.upsert({
      create: {
        amount: config.price,
        checkoutKey,
        paymentMethod: parsed.data.paymentMethod,
        plan: parsed.data.plan,
        status: "PENDING",
        userId: user.id
      },
      update: {},
      where: { checkoutKey }
    });

    if (parsed.data.paymentMethod === "PIX") {
      const payment =
        toSubscriptionPixView(subscription) ??
        (await createSubscriptionPix(subscription.id, payer.email));
      revalidateSubscriptionPaths();
      return {
        data: { payment, subscriptionId: subscription.id },
        message: "Pix mensal gerado. Os beneficios valem por um mes apos a confirmacao.",
        ok: true
      };
    }

    const checkoutUrl =
      subscription.checkoutUrl ??
      (await createCardSubscriptionCheckout(subscription.id, payer.email));
    revalidateSubscriptionPaths();
    return {
      data: { checkoutUrl, subscriptionId: subscription.id },
      message: "Checkout recorrente criado com seguranca.",
      ok: true
    };
  } catch (error) {
    console.error("Subscription checkout failed", {
      message: error instanceof Error ? error.message : "unknown",
      plan: parsed.data.plan,
      userId: user.id
    });
    return { message: "Nao foi possivel iniciar a assinatura. Tente novamente.", ok: false };
  }
}

export async function checkSubscriptionPaymentAction(
  subscriptionId: string
): Promise<SubscriptionActionResult<{ status: string }>> {
  const user = await requireUser();
  const id = subscriptionIdSchema.safeParse(subscriptionId);
  if (!id.success) return { message: "Assinatura invalida.", ok: false };
  const subscription = await prisma.subscription.findFirst({
    where: { id: id.data, userId: user.id }
  });
  if (!subscription) return { message: "Assinatura nao encontrada.", ok: false };

  try {
    if (subscription.paymentMethod === "PIX" && subscription.providerPaymentId) {
      const result = await reconcileSubscriptionPayment(
        await getMercadoPagoPayment(subscription.providerPaymentId)
      );
      revalidateSubscriptionPaths();
      return {
        data: { status: result?.status ?? subscription.status },
        message: "Status atualizado.",
        ok: true
      };
    }
    if (subscription.providerSubscriptionId) {
      await reconcileSubscriptionPreapproval(
        await getMercadoPagoSubscription(subscription.providerSubscriptionId)
      );
    }
    const updated = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    revalidateSubscriptionPaths();
    return { data: { status: updated.status }, message: "Status atualizado.", ok: true };
  } catch (error) {
    console.error("Subscription status check failed", {
      message: error instanceof Error ? error.message : "unknown",
      subscriptionId: subscription.id,
      userId: user.id
    });
    return { message: "Ainda nao foi possivel atualizar a assinatura.", ok: false };
  }
}

export async function cancelSubscriptionAction(
  subscriptionId: string
): Promise<SubscriptionActionResult> {
  const user = await requireUser();
  const id = subscriptionIdSchema.safeParse(subscriptionId);
  if (!id.success) return { message: "Assinatura invalida.", ok: false };
  const subscription = await prisma.subscription.findFirst({
    where: { id: id.data, status: { in: ["PENDING", "ACTIVE", "PAST_DUE"] }, userId: user.id }
  });
  if (!subscription) return { message: "Nenhuma assinatura cancelavel foi encontrada.", ok: false };

  try {
    await closeOpenSubscription(subscription);
    await prisma.subscriptionEvent.upsert({
      create: {
        status: "CANCELED",
        subscriptionId: subscription.id,
        type: "USER_CANCELED",
        uniqueKey: `subscription:user-canceled:${subscription.id}`
      },
      update: {},
      where: { uniqueKey: `subscription:user-canceled:${subscription.id}` }
    });
    revalidateSubscriptionPaths();
    return {
      message:
        subscription.currentPeriodEnd && subscription.currentPeriodEnd > serverNow()
          ? "Renovacao cancelada. Seus beneficios continuam ate o fim do periodo pago."
          : "Assinatura cancelada.",
      ok: true
    };
  } catch (error) {
    console.error("Subscription cancellation failed", {
      message: error instanceof Error ? error.message : "unknown",
      subscriptionId: subscription.id,
      userId: user.id
    });
    return { message: "Nao foi possivel cancelar a assinatura.", ok: false };
  }
}
