import { prisma } from "@/server/db";

export async function getWalletPageData(userId: string) {
  const [wallet, transactions, deposits] = await Promise.all([
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
    })
  ]);
  return { balanceCents: wallet?.balanceCents ?? 0, deposits, transactions };
}
