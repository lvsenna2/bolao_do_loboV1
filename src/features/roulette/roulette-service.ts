import { randomInt } from "node:crypto";
import { Prisma, type RouletteSpinKind } from "@prisma/client";

import { getSaoPauloDateKey, serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import {
  BONUS_ROLLOVER_MULTIPLIER,
  creditWalletInTransaction
} from "@/features/wallet/services/wallet-service";
import {
  BONUS_ROULETTE_PRIZES,
  DAILY_ROULETTE_PRIZES,
  type RoulettePrize
} from "./roulette-config";

export function pickRoulettePrize(prizes: RoulettePrize[], draw?: number) {
  const total = prizes.reduce((sum, prize) => sum + prize.probabilityUnits, 0);
  let cursor = draw ?? randomInt(total);
  if (!Number.isInteger(cursor) || cursor < 0 || cursor >= total)
    throw new Error("ROULETTE_INVALID_DRAW");
  for (const prize of prizes) {
    if (cursor < prize.probabilityUnits) return prize;
    cursor -= prize.probabilityUnits;
  }
  throw new Error("ROULETTE_PRIZE_NOT_FOUND");
}

async function addFragments(tx: Prisma.TransactionClient, userId: string, amount: number) {
  const rewards = await tx.userRewardBalance.upsert({
    create: { specialFragments: amount, userId },
    update: { specialFragments: { increment: amount } },
    where: { userId }
  });
  const vouchers = Math.floor(rewards.specialFragments / 5);
  if (vouchers > 0) {
    await tx.userRewardBalance.update({
      data: {
        specialFragments: { decrement: vouchers * 5 },
        specialRoundVouchers: { increment: vouchers }
      },
      where: { userId }
    });
  }
}

async function applyPrize(
  tx: Prisma.TransactionClient,
  userId: string,
  spinId: string,
  spinDate: string,
  spinKind: RouletteSpinKind,
  prize: RoulettePrize
) {
  if (prize.id === "balance_200" || prize.id === "jackpot") {
    await creditWalletInTransaction(tx, {
      amountCents: prize.value,
      bucket: "BONUS",
      description: prize.name,
      relatedEntityId: spinId,
      rolloverRequirementCents: prize.value * BONUS_ROLLOVER_MULTIPLIER,
      type: "ROULETTE",
      uniqueKey: `roulette:${spinId}:balance`,
      userId
    });
  } else if (prize.id === "fragment" || prize.id === "surprise") {
    await addFragments(tx, userId, prize.value);
  } else if (prize.id === "special_voucher") {
    await tx.userRewardBalance.upsert({
      create: { specialRoundVouchers: 1, userId },
      update: { specialRoundVouchers: { increment: 1 } },
      where: { userId }
    });
  } else if (prize.id === "league_voucher") {
    await tx.userRewardBalance.upsert({
      create: { leagueVouchers: 1, userId },
      update: { leagueVouchers: { increment: 1 } },
      where: { userId }
    });
  } else if (prize.id === "promo") {
    await tx.userRewardBalance.upsert({
      create: {
        promoDiscountMaxCents: 100,
        promoDiscountPercent: 5,
        promoExpiresAt: new Date(serverNow().getTime() + 30 * 86_400_000),
        userId
      },
      update: {
        promoDiscountMaxCents: 100,
        promoDiscountPercent: 5,
        promoExpiresAt: new Date(serverNow().getTime() + 30 * 86_400_000)
      },
      where: { userId }
    });
  } else if (prize.id === "bonus_spin" && spinKind === "DAILY") {
    await tx.userRewardBalance.upsert({
      create: { bonusSpinDate: spinDate, bonusSpinsRemaining: 1, userId },
      update: { bonusSpinDate: spinDate, bonusSpinsRemaining: 1 },
      where: { userId }
    });
  }
}

export async function spinRoulette(
  userId: string,
  kind: RouletteSpinKind = "DAILY",
  draw?: number
) {
  const now = serverNow();
  const spinDate = getSaoPauloDateKey(now);
  const prizes = kind === "BONUS" ? BONUS_ROULETTE_PRIZES : DAILY_ROULETTE_PRIZES;
  const prize = pickRoulettePrize(prizes, draw);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const existing = await tx.dailyRouletteSpin.findUnique({
          where: { userId_spinDate_spinKind: { spinDate, spinKind: kind, userId } }
        });
        if (existing) throw new Error("ROULETTE_ALREADY_SPUN");

        if (kind === "BONUS") {
          const consumed = await tx.userRewardBalance.updateMany({
            data: { bonusSpinsRemaining: { decrement: 1 } },
            where: { bonusSpinDate: spinDate, bonusSpinsRemaining: { gt: 0 }, userId }
          });
          if (consumed.count !== 1) throw new Error("ROULETTE_NO_BONUS_SPIN");
        }

        const spin = await tx.dailyRouletteSpin.create({
          data: {
            prizeId: prize.id,
            prizeName: prize.name,
            prizeValue: prize.value,
            probabilityUnits: prize.probabilityUnits,
            spinDate,
            spinKind: kind,
            userId
          }
        });
        await applyPrize(tx, userId, spin.id, spinDate, kind, prize);
        await tx.notification.create({
          data: {
            body: `Resultado da Roleta Diaria: ${prize.name}.`,
            icon: prize.id === "jackpot" ? "jackpot" : "roulette",
            message: `Resultado da Roleta Diaria: ${prize.name}.`,
            relatedEntityId: spin.id,
            title: prize.id === "jackpot" ? "JACKPOT!" : "Roleta Diaria",
            type: "SUCCESS",
            uniqueKey: `roulette:result:${spin.id}`,
            userId
          }
        });
        return spin;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("ROULETTE_ALREADY_SPUN");
    }
    throw error;
  }
}

export async function getRouletteData(userId: string) {
  const spinDate = getSaoPauloDateKey(serverNow());
  const [todaySpins, recentSpins, rewards] = await Promise.all([
    prisma.dailyRouletteSpin.findMany({ where: { spinDate, userId } }),
    prisma.dailyRouletteSpin.findMany({
      orderBy: { createdAt: "desc" },
      take: 7,
      where: { userId }
    }),
    prisma.userRewardBalance.findUnique({ where: { userId } })
  ]);
  return {
    bonusAvailable: Boolean(rewards?.bonusSpinDate === spinDate && rewards.bonusSpinsRemaining > 0),
    dailyAvailable: !todaySpins.some((spin) => spin.spinKind === "DAILY"),
    recentSpins,
    rewards
  };
}
