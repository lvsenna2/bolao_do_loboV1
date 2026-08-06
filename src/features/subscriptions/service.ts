import type { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import { getPlanConfig, NO_SUBSCRIPTION_BENEFITS, type SubscriptionBenefits } from "./config";

export function subscriptionHasBenefits(
  subscription: { currentPeriodEnd: Date | null; status: SubscriptionStatus } | null,
  now = serverNow()
) {
  if (!subscription?.currentPeriodEnd || subscription.currentPeriodEnd <= now) return false;
  return subscription.status === "ACTIVE" || subscription.status === "CANCELED";
}

export async function getCurrentSubscription(userId: string) {
  await expireEndedSubscriptions(userId);
  return prisma.subscription.findFirst({
    orderBy: { createdAt: "desc" },
    where: { userId }
  });
}

export async function expireEndedSubscriptions(userId?: string) {
  return prisma.subscription.updateMany({
    data: { status: "EXPIRED" },
    where: {
      currentPeriodEnd: { lte: serverNow() },
      status: { in: ["ACTIVE", "CANCELED", "PAST_DUE"] },
      ...(userId ? { userId } : {})
    }
  });
}

export async function getBenefitSubscription(userId: string) {
  await expireEndedSubscriptions(userId);
  const now = serverNow();
  return prisma.subscription.findFirst({
    orderBy: [{ status: "asc" }, { currentPeriodEnd: "desc" }],
    where: {
      currentPeriodEnd: { gt: now },
      status: { in: ["ACTIVE", "CANCELED"] },
      userId
    }
  });
}

export async function hasActiveSubscription(userId: string) {
  const subscription = await getBenefitSubscription(userId);
  return subscriptionHasBenefits(subscription);
}

export async function getCurrentPlan(userId: string): Promise<SubscriptionPlan | null> {
  const subscription = await getBenefitSubscription(userId);
  return subscriptionHasBenefits(subscription) ? subscription!.plan : null;
}

export async function getSubscriptionBenefits(userId: string): Promise<SubscriptionBenefits> {
  const plan = await getCurrentPlan(userId);
  return plan ? getPlanConfig(plan).benefits : NO_SUBSCRIPTION_BENEFITS;
}

export async function canCreateSpecialRound(userId: string) {
  return (await getSubscriptionBenefits(userId)).canCreateSpecialRound;
}

export async function hasFreeLeagueAccess(userId: string) {
  return (await getSubscriptionBenefits(userId)).freeLeagues;
}

export async function getSubscriptionBadge(userId: string) {
  return (await getSubscriptionBenefits(userId)).badge;
}

export function calculateSubscriptionDiscount(
  amount: number,
  benefits: Pick<SubscriptionBenefits, "discountPercent" | "freeLeagues">
) {
  const originalAmount = Math.max(0, Number(amount.toFixed(2)));
  const discountPercent = benefits.freeLeagues
    ? 100
    : Math.min(100, Math.max(0, benefits.discountPercent));
  const finalAmount = Number((originalAmount * (1 - discountPercent / 100)).toFixed(2));
  return {
    discountAmount: Number((originalAmount - finalAmount).toFixed(2)),
    discountPercent,
    finalAmount,
    originalAmount
  };
}
