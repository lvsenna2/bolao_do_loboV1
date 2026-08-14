import { prisma } from "@/server/db";

export async function getWalletPageData(userId: string) {
  const [wallet, transactions, deposits, withdrawals] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId } }),
    prisma.walletTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      where: { userId }
    }),
    prisma.walletDeposit.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      where: { status: "PENDING", userId }
    }),
    prisma.walletWithdrawal.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      where: { userId }
    })
  ]);
  const balanceCents = wallet?.balanceCents ?? 0;
  const bonusBalanceCents = wallet?.bonusBalanceCents ?? 0;
  return {
    balanceCents,
    bonusBalanceCents,
    deposits,
    totalCents: balanceCents + bonusBalanceCents,
    transactions,
    withdrawals
  };
}

export function getPendingWithdrawalsForAdmin() {
  return prisma.walletWithdrawal.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      adminNote: true,
      amountCents: true,
      createdAt: true,
      id: true,
      paidAt: true,
      pixKey: true,
      pixKeyOwnerName: true,
      pixKeyType: true,
      receiptRef: true,
      reviewedAt: true,
      status: true,
      user: { select: { email: true, id: true, name: true, username: true } }
    },
    take: 100,
    where: { status: { in: ["REQUESTED", "APPROVED"] } }
  });
}

export function getReviewedWithdrawalsForAdmin() {
  return prisma.walletWithdrawal.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      adminNote: true,
      amountCents: true,
      createdAt: true,
      id: true,
      paidAt: true,
      pixKey: true,
      pixKeyOwnerName: true,
      pixKeyType: true,
      receiptRef: true,
      reviewedAt: true,
      status: true,
      user: { select: { email: true, id: true, name: true, username: true } }
    },
    take: 30,
    where: { status: { in: ["PAID", "REJECTED", "CANCELLED"] } }
  });
}
