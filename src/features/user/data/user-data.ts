import type { Prisma } from "@prisma/client";
import { cache } from "react";

import { prisma } from "@/server/db";
import { getCachedActiveXpLevels } from "@/features/xp/data/xp-level-cache";
import { getActiveXpLevels, getXpProgressFromLevels } from "@/features/xp/services/xp-service";
import { formatDateTimeInSaoPaulo, serverNow } from "@/lib/date-time";
import type { UserDataResult } from "../types/user-action-result";

function emptyResult<T>(message: string, data: T): UserDataResult<T> {
  return {
    ok: false,
    message,
    data
  };
}

export function formatDate(date: Date | null | undefined) {
  return formatDateTimeInSaoPaulo(date);
}

export function formatCurrency(value: Prisma.Decimal | number | null | undefined) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value?.toNumber === "function"
        ? value.toNumber()
        : 0;

  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency"
  }).format(amount);
}

const loadUserDashboardIdentity = cache(async (userId: string) => {
  const [user, levels] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        avatarUrl: true,
        createdAt: true,
        id: true,
        lastLoginAt: true,
        name: true,
        role: true,
        status: true,
        username: true,
        xp: true
      }
    }),
    getCachedActiveXpLevels()
  ]);

  return {
    user,
    xpProgress: user ? getXpProgressFromLevels(user.xp, levels) : null
  };
});

export function getUserDashboardIdentity(userId: string) {
  return loadUserDashboardIdentity(userId);
}

export async function getUserHomeData(userId: string) {
  const startedAt = Date.now();
  const empty = {
    currentRound: null,
    leagueRanking: [],
    memberships: [],
    stats: {
      guesses: 0,
      myLeaguePosition: null,
      points: 0
    },
    todayMatches: [],
    user: null,
    xpProgress: null
  };

  try {
    const identityPromise = loadUserDashboardIdentity(userId);
    const membershipsPromise = prisma.leagueMember.findMany({
      select: {
        leagueId: true
      },
      orderBy: {
        joinedAt: "desc"
      },
      take: 4,
      where: {
        league: {
          championship: {
            deletedAt: null
          },
          deletedAt: null,
          status: {
            not: "ARCHIVED"
          }
        },
        status: "ACTIVE",
        userId
      }
    });
    const memberships = await membershipsPromise;
    const activeLeagueIds = memberships.map((membership) => membership.leagueId);
    const primaryLeagueId = activeLeagueIds[0];

    if (activeLeagueIds.length === 0) {
      const identity = await identityPromise;
      const { user, xpProgress } = identity;

      return {
        ok: true as const,
        data: {
          currentRound: null,
          leagueRanking: [],
          memberships,
          stats: {
            guesses: 0,
            myLeaguePosition: null,
            points: 0
          },
          todayMatches: [],
          user,
          xpProgress
        }
      };
    }

    const now = serverNow();
    const dashboardDetailsPromise = Promise.all([
      prisma.guess.count({
        where: {
          deletedAt: null,
          leagueId: {
            in: activeLeagueIds
          },
          userId
        }
      }),
      prisma.score.groupBy({
        by: ["userId"],
        _sum: {
          totalPoints: true
        },
        where: {
          guess: {
            deletedAt: null
          },
          leagueId: {
            in: activeLeagueIds
          },
          userId
        }
      }),
      prisma.round.findFirst({
        include: {
          league: {
            select: {
              championshipId: true
            }
          },
          matches: {
            select: {
              id: true,
              status: true
            },
            where: {
              deletedAt: null
            }
          },
          season: {
            select: {
              championship: {
                select: {
                  id: true,
                  name: true
                }
              },
              name: true,
              year: true
            }
          }
        },
        orderBy: {
          startsAt: "asc"
        },
        where: {
          leagueId: {
            in: activeLeagueIds
          },
          status: {
            in: ["OPEN", "LIVE", "SCHEDULED"]
          }
        }
      }),
      prisma.match.findMany({
        orderBy: {
          kickoff: "asc"
        },
        select: {
          awayTeam: {
            select: {
              apiId: true,
              logo: true,
              name: true,
              shortName: true
            }
          },
          homeTeam: {
            select: {
              apiId: true,
              logo: true,
              name: true,
              shortName: true
            }
          },
          id: true,
          kickoff: true,
          guesses: {
            select: {
              id: true,
              joker: true
            },
            where: {
              deletedAt: null,
              leagueId: {
                in: activeLeagueIds
              },
              userId
            }
          },
          round: {
            select: {
              league: {
                select: {
                  championshipId: true
                }
              },
              leagueId: true,
              season: {
                select: {
                  championship: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          },
          status: true
        },
        take: 4,
        where: {
          deletedAt: null,
          kickoff: {
            gt: now
          },
          round: {
            endsAt: {
              gte: now
            },
            leagueId: {
              in: activeLeagueIds
            },
            status: "OPEN"
          },
          status: "SCHEDULED"
        }
      }),
      prisma.ranking.findMany({
        include: {
          user: {
            select: {
              avatarUrl: true,
              id: true,
              name: true,
              username: true
            }
          }
        },
        orderBy: {
          position: "asc"
        },
        take: 1,
        where: {
          leagueId: primaryLeagueId,
          roundId: null,
          scope: "LEAGUE",
          seasonId: null
        }
      }),
      prisma.ranking.findFirst({
        select: {
          position: true
        },
        where: {
          leagueId: primaryLeagueId,
          roundId: null,
          scope: "LEAGUE",
          seasonId: null,
          userId
        }
      })
    ]);
    const [identity, dashboardDetails] = await Promise.all([
      identityPromise,
      dashboardDetailsPromise
    ]);
    const { user, xpProgress } = identity;
    const [guessCount, scoreGroups, currentRound, upcomingMatches, leagueRanking, myLeagueRanking] =
      dashboardDetails;

    const currentRoundView =
      currentRound?.league?.championshipId === currentRound?.season.championship.id
        ? currentRound
        : null;
    const consistentUpcomingMatches = upcomingMatches.filter(
      (match) => match.round.league?.championshipId === match.round.season.championship.id
    );
    const todayMatches = consistentUpcomingMatches;
    const points = scoreGroups.reduce((sum, group) => sum + (group._sum.totalPoints ?? 0), 0);

    return {
      ok: true as const,
      data: {
        currentRound: currentRoundView,
        leagueRanking,
        memberships,
        stats: {
          guesses: guessCount,
          myLeaguePosition: myLeagueRanking?.position ?? null,
          points
        },
        todayMatches,
        user,
        xpProgress
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar sua area.", empty);
  } finally {
    const durationMs = Date.now() - startedAt;
    if (durationMs >= 750) {
      console.warn("[performance] Dashboard demorou para carregar", { durationMs });
    }
  }
}

export async function getUserProfileData(userId: string) {
  const empty = {
    stats: {
      guesses: 0,
      points: 0
    },
    xpProgress: null,
    user: null
  };

  try {
    const [user, guessCount, scoreAggregate, levels] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          avatarUrl: true,
          createdAt: true,
          email: true,
          firstName: true,
          id: true,
          lastName: true,
          locale: true,
          name: true,
          status: true,
          theme: true,
          username: true,
          xp: true
        }
      }),
      prisma.guess.count({ where: { deletedAt: null, userId } }),
      prisma.score.aggregate({ _sum: { totalPoints: true }, where: { userId } }),
      getActiveXpLevels()
    ]);
    const xpProgress = user ? getXpProgressFromLevels(user.xp, levels) : null;

    return {
      ok: true as const,
      data: {
        stats: {
          guesses: guessCount,
          points: scoreAggregate._sum.totalPoints ?? 0
        },
        xpProgress,
        user
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar seu perfil.", empty);
  }
}

export async function getUserLeagues(userId: string) {
  const empty = {
    availableLeagues: [],
    memberships: [],
    ownedLeagues: []
  };

  try {
    const [memberships, ownedLeagues, availableLeagues] = await prisma.$transaction([
      prisma.leagueMember.findMany({
        include: {
          league: {
            include: {
              championship: {
                select: {
                  apiId: true,
                  country: true,
                  id: true,
                  logo: true,
                  name: true,
                  seasons: {
                    orderBy: {
                      year: "desc"
                    },
                    select: {
                      name: true,
                      year: true
                    },
                    take: 1
                  }
                }
              },
              owner: {
                select: {
                  name: true,
                  email: true
                }
              },
              payments: {
                orderBy: {
                  createdAt: "desc"
                },
                select: {
                  amount: true,
                  expiresAt: true,
                  gateway: true,
                  id: true,
                  qrCode: true,
                  qrCodeBase64: true,
                  status: true,
                  ticketUrl: true,
                  transactionId: true
                },
                take: 1,
                where: {
                  gateway: "MERCADO_PAGO",
                  status: "PENDING",
                  userId
                }
              },
              _count: {
                select: {
                  members: true,
                  payments: true
                }
              }
            }
          }
        },
        orderBy: {
          joinedAt: "desc"
        },
        where: {
          league: {
            championship: {
              deletedAt: null
            },
            deletedAt: null,
            status: {
              not: "ARCHIVED"
            }
          },
          status: {
            not: "LEFT"
          },
          userId
        }
      }),
      prisma.league.findMany({
        include: {
          championship: {
            select: {
              apiId: true,
              country: true,
              id: true,
              logo: true,
              name: true,
              seasons: {
                orderBy: {
                  year: "desc"
                },
                select: {
                  name: true,
                  year: true
                },
                take: 1
              }
            }
          },
          _count: {
            select: {
              members: true,
              payments: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        where: {
          status: {
            not: "ARCHIVED"
          },
          championship: {
            deletedAt: null
          },
          ownerId: userId,
          deletedAt: null
        }
      }),
      prisma.league.findMany({
        include: {
          championship: {
            select: {
              apiId: true,
              country: true,
              id: true,
              logo: true,
              name: true,
              seasons: {
                orderBy: {
                  year: "desc"
                },
                select: {
                  name: true,
                  year: true
                },
                take: 1
              }
            }
          },
          owner: {
            select: {
              name: true,
              email: true
            }
          },
          _count: {
            select: {
              members: true,
              payments: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 50,
        where: {
          deletedAt: null,
          status: {
            in: ["OPEN", "ACTIVE"]
          },
          visibility: {
            in: ["PUBLIC", "PRIVATE"]
          },
          championship: {
            deletedAt: null,
            status: "ACTIVE"
          },
          members: {
            none: {
              status: {
                not: "LEFT"
              },
              userId
            }
          }
        }
      })
    ]);

    return {
      ok: true as const,
      data: {
        availableLeagues,
        memberships,
        ownedLeagues
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar suas ligas.", empty);
  }
}

export async function getUserNotifications(
  userId: string,
  searchParams: Record<string, string | string[] | undefined>
) {
  const empty = {
    filter: "all",
    filterUnread: 0,
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    unread: 0
  };

  try {
    const filterValue = searchParams.filter;
    const filter = Array.isArray(filterValue) ? filterValue[0] : (filterValue ?? "all");
    const pageValue = searchParams.page;
    const pageNumber = Number(Array.isArray(pageValue) ? pageValue[0] : pageValue);
    const page = Number.isFinite(pageNumber) && pageNumber > 0 ? Math.floor(pageNumber) : 1;
    const pageSize = 20;
    const where = {
      userId,
      ...(filter === "unread" ? { isRead: false } : {}),
      ...(filter === "system" ? { type: "SYSTEM" as const } : {}),
      ...(filter === "payment" ? { type: "PAYMENT" as const } : {}),
      ...(filter === "xp" ? { type: "XP" as const } : {}),
      ...(filter === "special-round" ? { type: "SPECIAL_ROUND" as const } : {})
    };

    const [items, unread, filterUnread, total] = await prisma.$transaction([
      prisma.notification.findMany({
        orderBy: {
          createdAt: "desc"
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        where
      }),
      prisma.notification.count({
        where: {
          userId,
          isRead: false
        }
      }),
      prisma.notification.count({
        where: {
          ...where,
          isRead: false
        }
      }),
      prisma.notification.count({
        where
      })
    ]);

    return {
      ok: true as const,
      data: {
        filter,
        filterUnread,
        items,
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        unread
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar suas notificacoes.", empty);
  }
}

export const getUnreadNotificationCount = cache(async (userId: string) => {
  try {
    return await prisma.notification.count({
      where: {
        isRead: false,
        userId
      }
    });
  } catch {
    return 0;
  }
});

export async function getUserAchievements(userId: string) {
  const empty = {
    achieved: [],
    leagueAwards: [],
    locked: []
  };

  try {
    const [achievements, badges, leagueAwards] = await prisma.$transaction([
      prisma.achievement.findMany({
        include: {
          badge: true
        },
        orderBy: {
          unlockedAt: "desc"
        },
        where: {
          userId
        }
      }),
      prisma.badge.findMany({
        orderBy: {
          title: "asc"
        }
      }),
      prisma.leagueBadgeAward.findMany({
        include: {
          badge: true,
          championship: {
            select: { name: true }
          },
          league: {
            select: {
              championship: { select: { name: true } },
              name: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        where: { userId }
      })
    ]);

    const achievedBadgeIds = new Set([
      ...achievements.map((achievement) => achievement.badgeId),
      ...leagueAwards.map((award) => award.badgeId)
    ]);

    return {
      ok: true as const,
      data: {
        achieved: achievements,
        leagueAwards,
        locked: badges.filter((badge) => !achievedBadgeIds.has(badge.id))
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar suas conquistas.", empty);
  }
}

export async function getUserStatistics(userId: string) {
  const empty = {
    exactScoreRate: 0,
    exactScores: 0,
    guesses: 0,
    losses: 0,
    points: 0,
    rankings: [],
    winRate: 0,
    winnerHits: 0
  };

  try {
    const [guessCount, scores, rankingRows] = await prisma.$transaction([
      prisma.guess.count({
        where: {
          userId,
          deletedAt: null
        }
      }),
      prisma.score.findMany({
        select: {
          totalPoints: true,
          winnerHit: true,
          exactScore: true
        },
        where: {
          userId
        }
      }),
      prisma.ranking.findMany({
        include: {
          league: {
            select: {
              name: true
            }
          },
          season: {
            select: {
              name: true,
              year: true
            }
          },
          round: {
            select: {
              name: true,
              number: true
            }
          }
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 10,
        where: {
          userId
        }
      })
    ]);

    const winnerHits = scores.filter((score) => score.winnerHit).length;
    const exactScores = scores.filter((score) => score.exactScore).length;
    const points = scores.reduce((sum, score) => sum + score.totalPoints, 0);
    const losses = Math.max(0, scores.length - winnerHits);

    return {
      ok: true as const,
      data: {
        exactScoreRate: guessCount > 0 ? Math.round((exactScores / guessCount) * 100) : 0,
        exactScores,
        guesses: guessCount,
        losses,
        points,
        rankings: rankingRows,
        winRate: guessCount > 0 ? Math.round((winnerHits / guessCount) * 100) : 0,
        winnerHits
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar suas estatisticas.", empty);
  }
}
