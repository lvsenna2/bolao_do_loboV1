import { formatDateTimeInSaoPaulo, serverNow } from "@/lib/date-time";
import { getPlanConfig } from "./config";
import { getBenefitSubscription, getCurrentSubscription } from "./service";
import { toSubscriptionPixView } from "./payment-service";

export async function getSubscriptionPageData(userId: string) {
  const [current, benefit] = await Promise.all([
    getCurrentSubscription(userId),
    getBenefitSubscription(userId)
  ]);
  const now = serverNow();
  return {
    activeBenefits: benefit ? getPlanConfig(benefit.plan).benefits : null,
    current: current
      ? {
          amount: Number(current.amount),
          canceledAt: current.canceledAt,
          checkoutUrl: current.checkoutUrl,
          currentPeriodEnd: current.currentPeriodEnd,
          currentPeriodEndLabel: current.currentPeriodEnd
            ? formatDateTimeInSaoPaulo(current.currentPeriodEnd)
            : null,
          hasBenefits: Boolean(
            benefit &&
            benefit.id === current.id &&
            benefit.currentPeriodEnd &&
            benefit.currentPeriodEnd > now
          ),
          id: current.id,
          paymentMethod: current.paymentMethod,
          pendingPayment: current.paymentMethod === "PIX" ? toSubscriptionPixView(current) : null,
          plan: current.plan,
          status: current.status
        }
      : null
  };
}
