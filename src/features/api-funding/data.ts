import { getSaoPauloMonthRangeUtc, serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import { toApiFundingPaymentView } from "./payment-service";

export async function getApiFundingOverview(userId: string) {
  const now = serverNow();
  const month = getSaoPauloMonthRangeUtc(now);
  const [allTime, currentMonth, own, contributors, recent, pending] = await Promise.all([
    prisma.apiFundingContribution.aggregate({
      _count: true,
      _sum: { amount: true },
      where: { status: "APPROVED" }
    }),
    prisma.apiFundingContribution.aggregate({
      _count: true,
      _sum: { amount: true },
      where: { paidAt: { gte: month.start, lt: month.end }, status: "APPROVED" }
    }),
    prisma.apiFundingContribution.aggregate({
      _count: true,
      _sum: { amount: true },
      where: { status: "APPROVED", userId }
    }),
    prisma.apiFundingContribution.groupBy({
      by: ["userId"],
      where: { status: "APPROVED" }
    }),
    prisma.apiFundingContribution.findMany({
      orderBy: { paidAt: "desc" },
      select: { amount: true, id: true, paidAt: true },
      take: 8,
      where: { status: "APPROVED" }
    }),
    prisma.apiFundingContribution.findFirst({
      orderBy: { createdAt: "desc" },
      where: {
        paymentExpiresAt: { gt: now },
        qrCode: { not: null },
        qrCodeBase64: { not: null },
        status: "PENDING",
        transactionId: { not: null },
        userId
      }
    })
  ]);

  return {
    allTimeAmount: Number(allTime._sum.amount ?? 0),
    allTimeCount: allTime._count,
    contributorCount: contributors.length,
    currentMonthAmount: Number(currentMonth._sum.amount ?? 0),
    currentMonthCount: currentMonth._count,
    ownAmount: Number(own._sum.amount ?? 0),
    ownCount: own._count,
    pendingPayment: pending ? toApiFundingPaymentView(pending) : null,
    recent: recent.map((contribution) => ({
      amount: Number(contribution.amount),
      id: contribution.id,
      paidAt: contribution.paidAt
    }))
  };
}
