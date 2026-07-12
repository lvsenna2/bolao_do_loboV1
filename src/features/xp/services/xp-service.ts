import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { getSaoPauloDateKey, getSaoPauloDayDifference, serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";

type XpClient = typeof prisma | Prisma.TransactionClient;

export const XP_EVENT_TYPES = {
  ADMIN_ADJUSTMENT: "ADMIN_ADJUSTMENT",
  DAILY_LOGIN: "DAILY_LOGIN",
  EXACT_SCORE: "EXACT_SCORE",
  GUESS_SUBMITTED: "GUESS_SUBMITTED",
  MISSION_REWARD: "MISSION_REWARD",
  RESULT_HIT: "RESULT_HIT",
  STREAK_3_DAYS: "STREAK_3_DAYS",
  STREAK_7_DAYS: "STREAK_7_DAYS",
  STREAK_15_DAYS: "STREAK_15_DAYS"
} as const;

export type XpEventType = (typeof XP_EVENT_TYPES)[keyof typeof XP_EVENT_TYPES];

export type XpLevelView = {
  active: boolean;
  benefits: Prisma.JsonValue | null;
  color: string;
  discountPercent: number;
  id: string;
  key: string;
  maxXp: number | null;
  medal: string;
  minXp: number;
  name: string;
  sortOrder: number;
};

export type XpProgressView = {
  currentLevel: XpLevelView;
  discountPercent: number;
  nextLevel: XpLevelView | null;
  nextThreshold: number | null;
  previousThreshold: number;
  progress: number;
  remainingXp: number;
  xp: number;
};

const fallbackLevel: XpLevelView = {
  active: true,
  benefits: null,
  color: "#94A3B8",
  discountPercent: 0,
  id: "fallback-iniciante",
  key: "iniciante",
  maxXp: 249,
  medal: "🥉",
  minXp: 0,
  name: "Iniciante",
  sortOrder: 1
};

const streakMilestones = [
  {
    days: 3,
    type: XP_EVENT_TYPES.STREAK_3_DAYS
  },
  {
    days: 7,
    type: XP_EVENT_TYPES.STREAK_7_DAYS
  },
  {
    days: 15,
    type: XP_EVENT_TYPES.STREAK_15_DAYS
  }
] as const;

function getDayDifference(a: Date, b: Date) {
  return getSaoPauloDayDifference(a, b);
}

function normalizeJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseMilestones(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is number => typeof item === "number");
}

function parseSettingNumber(value: Prisma.JsonValue | null | undefined, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function getRelatedEntityId(input: {
  adminId?: string | null;
  guessId?: string | null;
  leagueId?: string | null;
  matchId?: string | null;
  seasonId?: string | null;
  uniqueKey: string;
}) {
  const missionMatch = input.uniqueKey.match(/^mission:([^:]+):/);

  return (
    input.guessId ??
    input.matchId ??
    missionMatch?.[1] ??
    input.leagueId ??
    input.seasonId ??
    input.adminId ??
    null
  );
}

function getXpNotificationContent(type: XpEventType, amount: number) {
  const signedAmount = amount >= 0 ? `+${amount}` : String(amount);

  switch (type) {
    case XP_EVENT_TYPES.GUESS_SUBMITTED:
      return {
        icon: "clipboard-check",
        title: `${signedAmount} XP`,
        message: `Voce recebeu ${signedAmount} XP por realizar um palpite.`
      };
    case XP_EVENT_TYPES.RESULT_HIT:
      return {
        icon: "target",
        title: "Resultado correto!",
        message: `Voce recebeu ${signedAmount} XP por acertar o vencedor da partida.`
      };
    case XP_EVENT_TYPES.EXACT_SCORE:
      return {
        icon: "crosshair",
        title: "Placar exato!",
        message: `Voce recebeu ${signedAmount} XP por acertar o placar exato.`
      };
    case XP_EVENT_TYPES.MISSION_REWARD:
      return {
        icon: "trophy",
        title: "Missao concluida",
        message: `Parabens! Voce ganhou ${signedAmount} XP.`
      };
    case XP_EVENT_TYPES.DAILY_LOGIN:
      return {
        icon: "calendar-check",
        title: "Login diario",
        message: `Voce recebeu ${signedAmount} XP pelo bonus de login.`
      };
    case XP_EVENT_TYPES.STREAK_3_DAYS:
    case XP_EVENT_TYPES.STREAK_7_DAYS:
    case XP_EVENT_TYPES.STREAK_15_DAYS:
      return {
        icon: "flame",
        title: "Sequencia de participacao",
        message: `Voce recebeu ${signedAmount} XP por manter sua sequencia ativa.`
      };
    case XP_EVENT_TYPES.ADMIN_ADJUSTMENT:
      return {
        icon: amount >= 0 ? "gift" : "settings",
        title: amount >= 0 ? "Recompensa especial" : "Ajuste de XP",
        message:
          amount >= 0
            ? `Voce recebeu ${signedAmount} XP como recompensa especial.`
            : `Seu XP foi ajustado em ${signedAmount} XP.`
      };
    default:
      return {
        icon: "sparkles",
        title: `${signedAmount} XP`,
        message: `Voce recebeu ${signedAmount} XP.`
      };
  }
}

async function createXpNotification(
  client: Prisma.TransactionClient,
  input: {
    adminId?: string | null;
    amount: number;
    guessId?: string | null;
    leagueId?: string | null;
    matchId?: string | null;
    seasonId?: string | null;
    type: XpEventType;
    uniqueKey: string;
    userId: string;
  },
  levelAfter: number
) {
  const content = getXpNotificationContent(input.type, input.amount);
  const notificationKey = `xp:${input.uniqueKey}`;

  await client.notification.upsert({
    create: {
      body: content.message,
      icon: content.icon,
      isRead: false,
      levelAfter,
      message: content.message,
      relatedEntityId: getRelatedEntityId(input),
      title: content.title,
      type: "XP",
      uniqueKey: notificationKey,
      userId: input.userId,
      xpReceived: input.amount
    },
    update: {},
    where: {
      uniqueKey: notificationKey
    }
  });
}

async function createLevelUpNotification(
  client: Prisma.TransactionClient,
  input: {
    amount: number;
    uniqueKey: string;
    userId: string;
  },
  level: XpLevelView
) {
  await client.notification.upsert({
    create: {
      body: `Voce alcancou a patente ${level.name}.`,
      icon: "medal",
      isRead: false,
      levelAfter: level.sortOrder,
      message: `Voce alcancou a patente ${level.name}.`,
      relatedEntityId: level.id,
      title: "Novo nivel!",
      type: "XP",
      uniqueKey: `xp-level:${input.userId}:${level.key}`,
      userId: input.userId,
      xpReceived: input.amount
    },
    update: {},
    where: {
      uniqueKey: `xp-level:${input.userId}:${level.key}`
    }
  });
}

async function createAchievementNotification(
  client: XpClient,
  userId: string,
  badge: {
    description: string;
    id: string;
    key: string | null;
    title: string;
  }
) {
  const user = await client.user.findUnique({
    select: {
      level: true
    },
    where: {
      id: userId
    }
  });

  await client.notification.upsert({
    create: {
      body: `Conquista desbloqueada: ${badge.description}`,
      icon: "award",
      isRead: false,
      levelAfter: user?.level ?? null,
      message: `Conquista desbloqueada: ${badge.description}`,
      relatedEntityId: badge.id,
      title: badge.title,
      type: "XP",
      uniqueKey: `achievement:${userId}:${badge.key ?? badge.id}`,
      userId,
      xpReceived: 0
    },
    update: {},
    where: {
      uniqueKey: `achievement:${userId}:${badge.key ?? badge.id}`
    }
  });
}

function isTestLeagueName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return normalized.includes("teste") || normalized.includes("test");
}

function isLeagueEligibleForXp(league: { name: string; status: string; xpEnabled: boolean }) {
  return (
    league.xpEnabled &&
    !["ARCHIVED", "DRAFT"].includes(league.status) &&
    !isTestLeagueName(league.name)
  );
}

export async function getActiveXpLevels(client: XpClient = prisma): Promise<XpLevelView[]> {
  const levels = await client.xpLevel.findMany({
    orderBy: [
      {
        minXp: "asc"
      },
      {
        sortOrder: "asc"
      }
    ],
    where: {
      active: true
    }
  });

  return levels.length > 0 ? levels : [fallbackLevel];
}

export function getLevelForXp(xp: number, levels: XpLevelView[]) {
  return (
    levels
      .filter((level) => level.minXp <= xp && (level.maxXp === null || level.maxXp >= xp))
      .sort((a, b) => b.minXp - a.minXp)[0] ??
    levels.filter((level) => level.minXp <= xp).sort((a, b) => b.minXp - a.minXp)[0] ??
    levels[0] ??
    fallbackLevel
  );
}

export function getXpProgressFromLevels(xp: number, levels: XpLevelView[]): XpProgressView {
  const orderedLevels = [...levels].sort((a, b) => a.minXp - b.minXp);
  const currentLevel = getLevelForXp(xp, orderedLevels);
  const nextLevel = orderedLevels.find((level) => level.minXp > xp) ?? null;
  const previousThreshold = currentLevel.minXp;
  const nextThreshold = nextLevel?.minXp ?? null;
  const span = nextThreshold ? Math.max(1, nextThreshold - previousThreshold) : 1;
  const progress = nextThreshold
    ? Math.min(100, Math.max(0, ((xp - previousThreshold) / span) * 100))
    : 100;

  return {
    currentLevel,
    discountPercent: currentLevel.discountPercent,
    nextLevel,
    nextThreshold,
    previousThreshold,
    progress,
    remainingXp: nextThreshold ? Math.max(0, nextThreshold - xp) : 0,
    xp
  };
}

async function getXpAmount(type: XpEventType, overrideAmount?: number, client: XpClient = prisma) {
  if (typeof overrideAmount === "number") {
    return overrideAmount;
  }

  const config = await client.xpTypeConfig.findUnique({
    select: {
      active: true,
      amount: true
    },
    where: {
      key: type
    }
  });

  if (!config || !config.active) {
    return null;
  }

  return config.amount;
}

export async function syncUserXpSnapshot(userId: string, client: XpClient = prisma) {
  const [levels, aggregate] = await Promise.all([
    getActiveXpLevels(client),
    client.xpEvent.aggregate({
      _sum: {
        amount: true
      },
      where: {
        userId
      }
    })
  ]);
  const xp = Math.max(0, aggregate._sum.amount ?? 0);
  const level = getLevelForXp(xp, levels);

  await client.user.update({
    data: {
      level: level.sortOrder,
      xp
    },
    where: {
      id: userId
    }
  });

  return {
    level,
    xp
  };
}

export async function grantXp(input: {
  adminId?: string | null;
  amount?: number;
  guessId?: string | null;
  leagueId?: string | null;
  matchId?: string | null;
  metadata?: unknown;
  seasonId?: string | null;
  type: XpEventType;
  uniqueKey: string;
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const amount = await getXpAmount(input.type, input.amount, tx);

    if (amount === null || amount === 0) {
      return {
        created: false,
        reason: "XP_SOURCE_INACTIVE" as const,
        xp: null
      };
    }

    const [currentUser, levels] = await Promise.all([
      tx.user.findUnique({
        select: {
          xp: true
        },
        where: {
          id: input.userId
        }
      }),
      getActiveXpLevels(tx)
    ]);
    const previousLevel = getLevelForXp(currentUser?.xp ?? 0, levels);

    try {
      await tx.xpEvent.create({
        data: {
          adminId: input.adminId ?? null,
          amount,
          guessId: input.guessId ?? null,
          leagueId: input.leagueId ?? null,
          matchId: input.matchId ?? null,
          metadata: normalizeJson(input.metadata),
          seasonId: input.seasonId ?? null,
          type: input.type,
          uniqueKey: input.uniqueKey,
          userId: input.userId
        }
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return {
          created: false,
          reason: "DUPLICATE" as const,
          xp: null
        };
      }

      throw error;
    }

    const snapshot = await syncUserXpSnapshot(input.userId, tx);
    await createXpNotification(
      tx,
      {
        adminId: input.adminId ?? null,
        amount,
        guessId: input.guessId ?? null,
        leagueId: input.leagueId ?? null,
        matchId: input.matchId ?? null,
        seasonId: input.seasonId ?? null,
        type: input.type,
        uniqueKey: input.uniqueKey,
        userId: input.userId
      },
      snapshot.level.sortOrder
    );

    if (snapshot.level.minXp > previousLevel.minXp) {
      await createLevelUpNotification(
        tx,
        {
          amount,
          uniqueKey: input.uniqueKey,
          userId: input.userId
        },
        snapshot.level
      );
    }

    return {
      created: true,
      reason: null,
      xp: snapshot
    };
  });
}

export async function grantGuessSubmittedXp(guessId: string) {
  const guess = await prisma.guess.findUnique({
    select: {
      deletedAt: true,
      id: true,
      league: {
        select: {
          id: true,
          name: true,
          status: true,
          xpEnabled: true
        }
      },
      leagueId: true,
      match: {
        select: {
          deletedAt: true,
          id: true,
          round: {
            select: {
              seasonId: true
            }
          },
          status: true
        }
      },
      matchId: true,
      submittedAt: true,
      userId: true
    },
    where: {
      id: guessId
    }
  });

  if (
    !guess ||
    guess.deletedAt ||
    !guess.league ||
    !guess.leagueId ||
    guess.match.deletedAt ||
    guess.match.status === "CANCELLED" ||
    !isLeagueEligibleForXp(guess.league)
  ) {
    return {
      created: false,
      reason: "NOT_ELIGIBLE" as const
    };
  }

  const result = await grantXp({
    guessId: guess.id,
    leagueId: guess.leagueId,
    matchId: guess.matchId,
    metadata: {
      source: "guess-submit"
    },
    seasonId: guess.match.round.seasonId,
    type: XP_EVENT_TYPES.GUESS_SUBMITTED,
    uniqueKey: `guess-submitted:${guess.id}`,
    userId: guess.userId
  });

  await Promise.all([
    result.created ? recordParticipationStreak(guess.userId, guess.submittedAt) : Promise.resolve(),
    result.created
      ? updateMissionProgress(guess.userId, "GUESSES_SUBMITTED", 1)
      : Promise.resolve(),
    evaluateAchievementsForUser(guess.userId)
  ]);

  return result;
}

export async function grantMatchResultXp(matchId: string) {
  const match = await prisma.match.findUnique({
    select: {
      deletedAt: true,
      homologatedAt: true,
      id: true,
      status: true
    },
    where: {
      id: matchId
    }
  });

  if (!match || match.deletedAt || match.status === "CANCELLED" || !match.homologatedAt) {
    return {
      exactScoreEvents: 0,
      resultHitEvents: 0
    };
  }

  const scores = await prisma.score.findMany({
    select: {
      exactScore: true,
      guessId: true,
      league: {
        select: {
          id: true,
          name: true,
          status: true,
          xpEnabled: true
        }
      },
      leagueId: true,
      match: {
        select: {
          round: {
            select: {
              seasonId: true
            }
          }
        }
      },
      matchId: true,
      userId: true,
      winnerHit: true
    },
    where: {
      matchId
    }
  });

  let resultHitEvents = 0;
  let exactScoreEvents = 0;
  const affectedUsers = new Set<string>();
  const resultMissionIncrements = new Map<string, number>();
  const exactMissionIncrements = new Map<string, number>();

  for (const score of scores) {
    if (!score.league || !score.leagueId || !isLeagueEligibleForXp(score.league)) {
      continue;
    }

    if (score.winnerHit) {
      const result = await grantXp({
        guessId: score.guessId,
        leagueId: score.leagueId,
        matchId: score.matchId,
        metadata: {
          source: "match-result"
        },
        seasonId: score.match.round.seasonId,
        type: XP_EVENT_TYPES.RESULT_HIT,
        uniqueKey: `result-hit:${score.guessId}`,
        userId: score.userId
      });

      if (result.created) {
        resultHitEvents += 1;
        resultMissionIncrements.set(
          score.userId,
          (resultMissionIncrements.get(score.userId) ?? 0) + 1
        );
      }
    }

    if (score.exactScore) {
      const result = await grantXp({
        guessId: score.guessId,
        leagueId: score.leagueId,
        matchId: score.matchId,
        metadata: {
          source: "match-exact-score"
        },
        seasonId: score.match.round.seasonId,
        type: XP_EVENT_TYPES.EXACT_SCORE,
        uniqueKey: `exact-score:${score.guessId}`,
        userId: score.userId
      });

      if (result.created) {
        exactScoreEvents += 1;
        exactMissionIncrements.set(
          score.userId,
          (exactMissionIncrements.get(score.userId) ?? 0) + 1
        );
      }
    }

    if (score.winnerHit || score.exactScore) {
      affectedUsers.add(score.userId);
    }
  }

  await Promise.all(
    [...affectedUsers].map(async (userId) => {
      await Promise.all([
        resultMissionIncrements.has(userId)
          ? updateMissionProgress(userId, "RESULT_HITS", resultMissionIncrements.get(userId) ?? 1)
          : Promise.resolve(),
        exactMissionIncrements.has(userId)
          ? updateMissionProgress(userId, "EXACT_SCORES", exactMissionIncrements.get(userId) ?? 1)
          : Promise.resolve(),
        evaluateAchievementsForUser(userId)
      ]);
    })
  );

  return {
    exactScoreEvents,
    resultHitEvents
  };
}

export async function recordParticipationStreak(userId: string, participationDate = serverNow()) {
  const current = await prisma.userStreak.findUnique({
    where: {
      userId
    }
  });
  const previousDate = current?.lastParticipationDate ?? null;
  const dayDifference = previousDate ? getDayDifference(participationDate, previousDate) : null;

  if (dayDifference === 0) {
    return current;
  }

  const currentCount = dayDifference === 1 ? (current?.currentCount ?? 0) + 1 : 1;
  const longestCount = Math.max(current?.longestCount ?? 0, currentCount);
  const awardedMilestones = parseMilestones(current?.awardedMilestones);

  const streak = await prisma.userStreak.upsert({
    create: {
      awardedMilestones,
      currentCount,
      lastParticipationDate: participationDate,
      longestCount,
      userId
    },
    update: {
      currentCount,
      lastParticipationDate: participationDate,
      longestCount
    },
    where: {
      userId
    }
  });

  const newlyAwarded: number[] = [];

  for (const milestone of streakMilestones) {
    if (currentCount >= milestone.days && !awardedMilestones.includes(milestone.days)) {
      const result = await grantXp({
        metadata: {
          days: milestone.days,
          source: "participation-streak"
        },
        type: milestone.type,
        uniqueKey: `streak:${userId}:${milestone.days}`,
        userId
      });

      if (result.created) {
        newlyAwarded.push(milestone.days);
      }
    }
  }

  if (newlyAwarded.length > 0) {
    await prisma.userStreak.update({
      data: {
        awardedMilestones: [...awardedMilestones, ...newlyAwarded]
      },
      where: {
        userId
      }
    });
  }

  return streak;
}

export async function updateMissionProgress(userId: string, type: string, increment: number) {
  const now = serverNow();
  const missions = await prisma.mission.findMany({
    where: {
      active: true,
      endsAt: {
        gte: now
      },
      startsAt: {
        lte: now
      },
      type
    }
  });

  for (const mission of missions) {
    const progress = await prisma.userMissionProgress.upsert({
      create: {
        completedAt: increment >= mission.target ? now : null,
        missionId: mission.id,
        progress: Math.min(mission.target, increment),
        userId
      },
      update: {
        progress: {
          increment
        }
      },
      where: {
        userId_missionId: {
          missionId: mission.id,
          userId
        }
      }
    });
    const currentProgress = Math.min(mission.target, progress.progress);

    if (!progress.completedAt && currentProgress >= mission.target) {
      await prisma.userMissionProgress.update({
        data: {
          completedAt: now,
          progress: mission.target
        },
        where: {
          id: progress.id
        }
      });
    }

    if (currentProgress >= mission.target && mission.xpReward > 0) {
      const result = await grantXp({
        amount: mission.xpReward,
        metadata: {
          missionKey: mission.key,
          source: "mission"
        },
        type: XP_EVENT_TYPES.MISSION_REWARD,
        uniqueKey: `mission:${mission.id}:${userId}`,
        userId
      });

      if (result.created) {
        await prisma.userMissionProgress.update({
          data: {
            rewardClaimedAt: now
          },
          where: {
            id: progress.id
          }
        });
      }
    }
  }
}

export async function syncActiveLeagueMissionProgress(userId: string) {
  const now = serverNow();
  const [activeLeagueCount, missions] = await Promise.all([
    prisma.leagueMember.count({
      where: {
        league: {
          deletedAt: null,
          status: {
            not: "ARCHIVED"
          }
        },
        status: "ACTIVE",
        userId
      }
    }),
    prisma.mission.findMany({
      where: {
        active: true,
        endsAt: {
          gte: now
        },
        startsAt: {
          lte: now
        },
        type: "ACTIVE_LEAGUES"
      }
    })
  ]);

  for (const mission of missions) {
    const completed = activeLeagueCount >= mission.target;
    const progress = await prisma.userMissionProgress.upsert({
      create: {
        completedAt: completed ? now : null,
        missionId: mission.id,
        progress: Math.min(mission.target, activeLeagueCount),
        userId
      },
      update: {
        completedAt: completed ? now : undefined,
        progress: Math.min(mission.target, activeLeagueCount)
      },
      where: {
        userId_missionId: {
          missionId: mission.id,
          userId
        }
      }
    });

    if (completed && mission.xpReward > 0) {
      const result = await grantXp({
        amount: mission.xpReward,
        metadata: {
          missionKey: mission.key,
          source: "mission"
        },
        type: XP_EVENT_TYPES.MISSION_REWARD,
        uniqueKey: `mission:${mission.id}:${userId}`,
        userId
      });

      if (result.created) {
        await prisma.userMissionProgress.update({
          data: {
            rewardClaimedAt: now
          },
          where: {
            id: progress.id
          }
        });
      }
    }
  }
}

export async function evaluateAchievementsForUser(userId: string) {
  const [guessCount, winnerHitCount, exactScoreCount, activeLeagues, streak] =
    await prisma.$transaction([
      prisma.guess.count({
        where: {
          deletedAt: null,
          userId
        }
      }),
      prisma.score.count({
        where: {
          guess: {
            deletedAt: null
          },
          userId,
          winnerHit: true
        }
      }),
      prisma.score.count({
        where: {
          exactScore: true,
          guess: {
            deletedAt: null
          },
          userId
        }
      }),
      prisma.leagueMember.count({
        where: {
          status: "ACTIVE",
          userId
        }
      }),
      prisma.userStreak.findUnique({
        select: {
          longestCount: true
        },
        where: {
          userId
        }
      })
    ]);
  const unlockedKeys = [
    guessCount >= 1 ? "FIRST_GUESS" : null,
    winnerHitCount >= 1 ? "FIRST_RESULT_HIT" : null,
    exactScoreCount >= 1 ? "FIRST_EXACT_SCORE" : null,
    guessCount >= 10 ? "TEN_GUESSES" : null,
    guessCount >= 50 ? "FIFTY_GUESSES" : null,
    guessCount >= 100 ? "ONE_HUNDRED_GUESSES" : null,
    exactScoreCount >= 5 ? "FIVE_EXACT_SCORES" : null,
    exactScoreCount >= 10 ? "TEN_EXACT_SCORES" : null,
    activeLeagues >= 10 ? "TEN_LEAGUES" : null,
    (streak?.longestCount ?? 0) >= 3 ? "STREAK_PARTICIPANT" : null
  ].filter((key): key is string => Boolean(key));

  if (unlockedKeys.length === 0) {
    return 0;
  }

  const badges = await prisma.badge.findMany({
    select: {
      description: true,
      id: true,
      key: true,
      title: true
    },
    where: {
      key: {
        in: unlockedKeys
      }
    }
  });

  if (badges.length === 0) {
    return 0;
  }

  const existingAchievements = await prisma.achievement.findMany({
    select: {
      badgeId: true
    },
    where: {
      badgeId: {
        in: badges.map((badge) => badge.id)
      },
      userId
    }
  });
  const existingBadgeIds = new Set(existingAchievements.map((achievement) => achievement.badgeId));
  const newBadges = badges.filter((badge) => !existingBadgeIds.has(badge.id));

  if (newBadges.length === 0) {
    return 0;
  }

  const result = await prisma.achievement.createMany({
    data: newBadges.map((badge) => ({
      badgeId: badge.id,
      userId
    })),
    skipDuplicates: true
  });

  await Promise.all(newBadges.map((badge) => createAchievementNotification(prisma, userId, badge)));

  return result.count;
}

export async function grantDailyLoginXp(userId: string, date = serverNow()) {
  const dateKey = getSaoPauloDateKey(date);

  return grantXp({
    metadata: {
      date: dateKey,
      source: "daily-login"
    },
    type: XP_EVENT_TYPES.DAILY_LOGIN,
    uniqueKey: `daily-login:${userId}:${dateKey}`,
    userId
  });
}

export async function grantManualXp(input: {
  adminId: string;
  amount: number;
  reason: string;
  userId: string;
}) {
  return grantXp({
    adminId: input.adminId,
    amount: input.amount,
    metadata: {
      reason: input.reason,
      source: "admin"
    },
    type: XP_EVENT_TYPES.ADMIN_ADJUSTMENT,
    uniqueKey: `admin-adjustment:${input.adminId}:${input.userId}:${randomUUID()}`,
    userId: input.userId
  });
}

export async function recalculateXpForUser(userId: string) {
  return syncUserXpSnapshot(userId);
}

export async function recalculateAllUsersXp() {
  const users = await prisma.user.findMany({
    select: {
      id: true
    },
    where: {
      deletedAt: null
    }
  });

  for (const user of users) {
    await syncUserXpSnapshot(user.id);
  }

  return users.length;
}

export async function getPaidLeagueMinimumEntryFee() {
  const setting = await prisma.setting.findUnique({
    select: {
      value: true
    },
    where: {
      key: "paidLeagueMinimumEntryFee"
    }
  });

  return parseSettingNumber(setting?.value, 1);
}

export async function setPaidLeagueMinimumEntryFee(value: number) {
  return prisma.setting.upsert({
    create: {
      key: "paidLeagueMinimumEntryFee",
      value
    },
    update: {
      value
    },
    where: {
      key: "paidLeagueMinimumEntryFee"
    }
  });
}

export async function getUserPaidLeaguePricing(userId: string, entryFee: number) {
  const [user, levels, minimumEntryFee] = await Promise.all([
    prisma.user.findUnique({
      select: {
        xp: true
      },
      where: {
        id: userId
      }
    }),
    getActiveXpLevels(),
    getPaidLeagueMinimumEntryFee()
  ]);
  const xp = user?.xp ?? 0;
  const level = getLevelForXp(xp, levels);
  const discountPercent = Math.max(0, level.discountPercent);
  const rawDiscountAmount = entryFee * (discountPercent / 100);
  const discountedAmount = entryFee - rawDiscountAmount;
  const finalAmount =
    entryFee > 0 ? Math.min(entryFee, Math.max(minimumEntryFee, discountedAmount)) : 0;
  const discountAmount = Math.max(0, entryFee - finalAmount);

  return {
    discountAmount,
    discountPercent,
    finalAmount,
    level,
    minimumEntryFee,
    originalAmount: entryFee
  };
}
