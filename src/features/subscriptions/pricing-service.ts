import { getUserPaidLeaguePricing } from "@/features/xp/services/xp-service";
import { calculateSubscriptionDiscount, getSubscriptionBenefits } from "./service";

export async function getPaidLeaguePricingForUser(userId: string, entryFee: number) {
  const [xpPricing, benefits] = await Promise.all([
    getUserPaidLeaguePricing(userId, entryFee),
    getSubscriptionBenefits(userId)
  ]);
  const subscriptionPricing = calculateSubscriptionDiscount(entryFee, benefits);
  if (subscriptionPricing.discountPercent <= xpPricing.discountPercent) return xpPricing;

  return {
    discountAmount: subscriptionPricing.discountAmount,
    discountPercent: subscriptionPricing.discountPercent,
    finalAmount: subscriptionPricing.finalAmount,
    level: { name: benefits.badge ? `Plano ${benefits.badge}` : "Assinatura" },
    minimumEntryFee: 0,
    originalAmount: subscriptionPricing.originalAmount
  };
}
