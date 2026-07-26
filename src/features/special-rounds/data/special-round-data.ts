import type { SpecialRoundStatus } from "@prisma/client";

import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import { calculateSpecialRoundPrizePool } from "../services/prize-service";

export async function getSpecialRoundsForUser(userId: string) {
  const now = serverNow();
  const rounds = await prisma.specialRound.findMany({
    include: {
      _count: { select: { entries: { where: { paymentStatus: "APPROVED" } } } },
      entries: {
        select: { id: true, paymentStatus: true },
        where: { userId }
      }
    },
    orderBy: [{ matchStartsAt: "asc" }]
  });

  const reminderLimit = new Date(now.getTime() + 60 * 60 * 1000);
  await Promise.all(
    rounds
      .filter(
        (round) =>
          round.status === "PREDICTIONS_OPEN" &&
          round.predictionsCloseAt > now &&
          round.predictionsCloseAt <= reminderLimit &&
          round.entries[0]?.paymentStatus === "APPROVED"
      )
      .map((round) =>
        prisma.notification.upsert({
          create: {
            body: `Os palpites de ${round.name} fecham em menos de uma hora.`,
            icon: "special-round-deadline",
            message: `Os palpites de ${round.name} fecham em menos de uma hora.`,
            relatedEntityId: round.id,
            title: "Palpites proximos do fechamento",
            type: "SPECIAL_ROUND",
            uniqueKey: `special-round:deadline:${round.id}:${userId}`,
            userId
          },
          update: {},
          where: { uniqueKey: `special-round:deadline:${round.id}:${userId}` }
        })
      )
  );

  return rounds.map((round) => {
    const paidAmounts = Array(round._count.entries).fill(Number(round.entryFee));
    const finance = calculateSpecialRoundPrizePool({
      adminFeePercent: Number(round.adminFeePercent),
      confirmedAmounts: paidAmounts,
      fixedPrize: round.fixedPrize ? Number(round.fixedPrize) : null,
      mode: round.prizeMode,
      poolPercent: Number(round.prizePoolPercent)
    });

    return { ...round, estimatedPrize: finance.prize, userEntry: round.entries[0] ?? null };
  });
}

export async function getSpecialRoundDetail(id: string, userId?: string) {
  const now = serverNow();
  const visibility = await prisma.specialRound.findUnique({
    select: { matchStartsAt: true, predictionsCloseAt: true, rankingPublishedAt: true },
    where: { id }
  });
  if (!visibility) return null;
  const predictionsArePublic =
    visibility.predictionsCloseAt <= now ||
    visibility.matchStartsAt <= now ||
    Boolean(visibility.rankingPublishedAt);
  return prisma.specialRound.findUnique({
    include: {
      _count: {
        select: { entries: { where: { blockedAt: null, paymentStatus: "APPROVED" } } }
      },
      entries: {
        include: {
          predictions: true,
          prize: true,
          standing: true,
          user: { select: { avatarUrl: true, id: true, name: true, username: true } }
        },
        orderBy: { registeredAt: "asc" },
        where: predictionsArePublic ? { paymentStatus: "APPROVED" } : { userId }
      },
      markets: {
        include: {
          options: { where: { active: true }, orderBy: { sortOrder: "asc" } },
          result: true
        },
        orderBy: { sortOrder: "asc" },
        where: { active: true }
      },
      standings: {
        include: {
          entry: {
            include: {
              prize: true,
              user: { select: { avatarUrl: true, id: true, name: true, username: true } }
            }
          }
        },
        orderBy: { position: "asc" }
      }
    },
    where: { id }
  });
}

export function getSpecialRoundPredictionReview(id: string, userId: string) {
  return prisma.specialRoundEntry.findUnique({
    include: {
      predictions: true,
      specialRound: {
        include: {
          markets: {
            include: {
              options: {
                orderBy: { sortOrder: "asc" },
                where: { active: true }
              },
              result: true
            },
            orderBy: { sortOrder: "asc" },
            where: { active: true }
          }
        }
      }
    },
    where: {
      specialRoundId_userId: {
        specialRoundId: id,
        userId
      }
    }
  });
}

export function getAdminSpecialRoundDetail(id: string) {
  return prisma.specialRound.findUnique({
    include: {
      entries: {
        include: {
          predictions: true,
          prize: true,
          standing: true,
          user: { select: { email: true, id: true, name: true } }
        },
        orderBy: { registeredAt: "asc" }
      },
      markets: {
        include: { options: { orderBy: { sortOrder: "asc" } }, result: true },
        orderBy: { sortOrder: "asc" }
      },
      standings: {
        include: {
          entry: {
            include: {
              prize: true,
              user: { select: { email: true, name: true } }
            }
          }
        },
        orderBy: { position: "asc" }
      }
    },
    where: { id }
  });
}

export function getAdminSpecialRounds(status?: SpecialRoundStatus) {
  return prisma.specialRound.findMany({
    include: {
      _count: { select: { entries: true, markets: true } },
      entries: { select: { amount: true, paymentStatus: true, transactionId: true } }
    },
    orderBy: { createdAt: "desc" },
    where: status ? { status } : undefined
  });
}

export async function getSpecialRoundMatchOptions() {
  const now = serverNow();
  const matches = await prisma.match.findMany({
    orderBy: { kickoff: "asc" },
    select: {
      awayTeam: { select: { id: true, logo: true, name: true } },
      homeTeam: { select: { id: true, logo: true, name: true } },
      id: true,
      kickoff: true,
      round: {
        select: {
          name: true,
          number: true,
          season: { select: { championship: { select: { name: true } }, name: true } }
        }
      }
    },
    take: 300,
    where: {
      deletedAt: null,
      kickoff: { gt: now },
      status: { in: ["SCHEDULED", "POSTPONED"] }
    }
  });
  return matches.map(({ kickoff, ...match }) => ({ ...match, startsAt: kickoff }));
}
