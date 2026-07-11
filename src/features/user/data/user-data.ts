import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import { getActiveXpLevels, getXpProgressFromLevels } from "@/features/xp/services/xp-service";
import type { UserDataResult } from "../types/user-action-result";

function emptyResult<T>(message: string, data: T): UserDataResult<T> {
  return {
    ok: false,
    message,
    data
  };
}

export function formatDate(date: Date | null | undefined) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
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

export function getXpProgress(xp: number) {
  const thresholds = [0, 250, 750, 2000, 5000, 10000, 20000, 40000, 80000, 150000];
  const nextThreshold = thresholds.find((threshold) => threshold > xp) ?? xp + 1000;
  const previousThreshold =
    thresholds
      .slice()
      .reverse()
      .find((threshold) => threshold <= xp) ?? 0;
  const span = Math.max(1, nextThreshold - previousThreshold);
  const progress = Math.min(100, Math.max(0, ((xp - previousThreshold) / span) * 100));

  return {
    nextThreshold,
    previousThreshold,
    progress
  };
}

export async function getUserHomeData(userId: string) {
  const empty = {
    achievements: [],
    currentRound: null,
    globalRanking: [],
    memberships: [],
    notifications: [],
    recentGuesses: [],
    stats: {
      exactScores: 0,
      guesses: 0,
      leagues: 0,
      losses: 0,
      myGlobalPosition: null,
      points: 0,
      unreadNotifications: 0,
      winRate: 0,
      winnerHits: 0
    },
    todayMatches: [],
    user: null
  };

  try {
    const [user, memberships, notifications, achievements, unread] = await prisma.$transaction([
      prisma.user.findUnique({
        where: {
          id: userId
        },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          avatarUrl: true,
          xp: true,
          level: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true
        }
      }),
      prisma.leagueMember.findMany({
        include: {
          league: {
            include: {
              championship: {
                select: {
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
                  members: true
                }
              }
            }
          }
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
      }),
      prisma.notification.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 5,
        where: {
          userId
        }
      }),
      prisma.achievement.findMany({
        include: {
          badge: true
        },
        orderBy: {
          unlockedAt: "desc"
        },
        take: 5,
        where: {
          userId
        }
      }),
      prisma.notification.count({
        where: {
          userId,
          readAt: null
        }
      })
    ]);

    const activeLeagueIds = memberships.map((membership) => membership.leagueId);
    const primaryLeagueId = activeLeagueIds[0];

    if (activeLeagueIds.length === 0) {
      return {
        ok: true as const,
        data: {
          achievements,
          currentRound: null,
          globalRanking: [],
          memberships,
          notifications,
          recentGuesses: [],
          stats: {
            exactScores: 0,
            guesses: 0,
            leagues: 0,
            losses: 0,
            myGlobalPosition: null,
            points: 0,
            unreadNotifications: unread,
            winRate: 0,
            winnerHits: 0
          },
          todayMatches: [],
          user
        }
      };
    }

    const now = new Date();
    const [
      guessCount,
      scores,
      currentRound,
      upcomingMatches,
      recentGuesses,
      globalRanking,
      myGlobalRanking
    ] = await prisma.$transaction([
      prisma.guess.count({
        where: {
          deletedAt: null,
          leagueId: {
            in: activeLeagueIds
          },
          userId
        }
      }),
      prisma.score.findMany({
        select: {
          exactScore: true,
          totalPoints: true,
          winnerHit: true
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
              logo: true,
              name: true,
              shortName: true
            }
          },
          homeTeam: {
            select: {
              logo: true,
              name: true,
              shortName: true
            }
          },
          id: true,
          kickoff: true,
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
        take: 8,
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
            startsAt: {
              lte: now
            },
            status: "OPEN"
          },
          status: "SCHEDULED"
        }
      }),
      prisma.guess.findMany({
        include: {
          match: {
            select: {
              awayTeam: {
                select: {
                  name: true,
                  shortName: true
                }
              },
              homeTeam: {
                select: {
                  name: true,
                  shortName: true
                }
              },
              kickoff: true,
              round: {
                select: {
                  league: {
                    select: {
                      championshipId: true
                    }
                  },
                  number: true,
                  name: true,
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
            }
          },
          score: {
            select: {
              exactScore: true,
              totalPoints: true,
              winnerHit: true
            }
          }
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 5,
        where: {
          deletedAt: null,
          leagueId: {
            in: activeLeagueIds
          },
          userId
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
        take: 10,
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

    const currentRoundView =
      currentRound?.league?.championshipId === currentRound?.season.championship.id
        ? currentRound
        : null;
    const consistentUpcomingMatches = upcomingMatches.filter(
      (match) => match.round.league?.championshipId === match.round.season.championship.id
    );
    const consistentRecentGuesses = recentGuesses.filter(
      (guess) =>
        guess.match.round.league?.championshipId === guess.match.round.season.championship.id
    );
    const upcomingMatchGuesses =
      consistentUpcomingMatches.length > 0
        ? await prisma.guess.findMany({
            select: {
              id: true,
              joker: true,
              leagueId: true,
              matchId: true
            },
            where: {
              deletedAt: null,
              leagueId: {
                in: activeLeagueIds
              },
              matchId: {
                in: consistentUpcomingMatches.map((match) => match.id)
              },
              userId
            }
          })
        : [];

    const guessesByMatchAndLeague = new Map(
      upcomingMatchGuesses.map((guess) => [`${guess.matchId}:${guess.leagueId}`, guess])
    );
    const todayMatches = consistentUpcomingMatches.map((match) => {
      const existingGuess = match.round.leagueId
        ? guessesByMatchAndLeague.get(`${match.id}:${match.round.leagueId}`)
        : undefined;

      return {
        ...match,
        guesses: existingGuess ? [{ id: existingGuess.id, joker: existingGuess.joker }] : []
      };
    });

    const winnerHits = scores.filter((score) => score.winnerHit).length;
    const exactScores = scores.filter((score) => score.exactScore).length;
    const points = scores.reduce((sum, score) => sum + score.totalPoints, 0);
    const losses = Math.max(0, scores.length - winnerHits);

    return {
      ok: true as const,
      data: {
        achievements,
        currentRound: currentRoundView,
        globalRanking,
        memberships,
        notifications,
        recentGuesses: consistentRecentGuesses,
        stats: {
          exactScores,
          guesses: guessCount,
          leagues: memberships.length,
          losses,
          myGlobalPosition: myGlobalRanking?.position ?? null,
          points,
          unreadNotifications: unread,
          winRate: scores.length > 0 ? Math.round((winnerHits / scores.length) * 100) : 0,
          winnerHits
        },
        todayMatches,
        user
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar sua area.", empty);
  }
}

export async function getUserProfileData(userId: string) {
  const empty = {
    achievements: [],
    missions: [],
    recentXpEvents: [],
    season: null,
    seasonXp: 0,
    stats: {
      exactScores: 0,
      guesses: 0,
      points: 0,
      winnerHits: 0
    },
    streak: null,
    xpProgress: null,
    user: null
  };

  try {
    const [user, achievements, guessCount, scores, recentXpEvents, activeSeason, streak, missions] =
      await prisma.$transaction([
        prisma.user.findUnique({
          where: {
            id: userId
          },
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            username: true,
            email: true,
            avatarUrl: true,
            locale: true,
            theme: true,
            xp: true,
            level: true,
            role: true,
            status: true,
            createdAt: true,
            lastLoginAt: true
          }
        }),
        prisma.achievement.findMany({
          include: {
            badge: true
          },
          orderBy: {
            unlockedAt: "desc"
          },
          take: 6,
          where: {
            userId
          }
        }),
        prisma.guess.count({
          where: {
            userId,
            deletedAt: null
          }
        }),
        prisma.score.findMany({
          select: {
            exactScore: true,
            totalPoints: true,
            winnerHit: true
          },
          where: {
            userId
          }
        }),
        prisma.xpEvent.findMany({
          include: {
            league: {
              select: {
                name: true
              }
            },
            match: {
              select: {
                awayTeam: {
                  select: {
                    shortName: true
                  }
                },
                homeTeam: {
                  select: {
                    shortName: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 12,
          where: {
            userId
          }
        }),
        prisma.season.findFirst({
          orderBy: {
            year: "desc"
          },
          select: {
            id: true,
            name: true,
            year: true
          },
          where: {
            championship: {
              leagues: {
                some: {
                  members: {
                    some: {
                      status: "ACTIVE",
                      userId
                    }
                  }
                }
              }
            },
            status: "ACTIVE"
          }
        }),
        prisma.userStreak.findUnique({
          where: {
            userId
          }
        }),
        prisma.userMissionProgress.findMany({
          include: {
            mission: true
          },
          orderBy: {
            updatedAt: "desc"
          },
          take: 4,
          where: {
            userId
          }
        })
      ]);
    const [levels, seasonXpAggregate] = await Promise.all([
      getActiveXpLevels(),
      activeSeason
        ? prisma.xpEvent.aggregate({
            _sum: {
              amount: true
            },
            where: {
              seasonId: activeSeason.id,
              userId
            }
          })
        : Promise.resolve({ _sum: { amount: 0 } })
    ]);

    const winnerHits = scores.filter((score) => score.winnerHit).length;
    const exactScores = scores.filter((score) => score.exactScore).length;
    const points = scores.reduce((sum, score) => sum + score.totalPoints, 0);
    const xpProgress = user ? getXpProgressFromLevels(user.xp, levels) : null;

    return {
      ok: true as const,
      data: {
        achievements,
        missions,
        recentXpEvents,
        season: activeSeason,
        seasonXp: Math.max(0, seasonXpAggregate._sum.amount ?? 0),
        stats: {
          exactScores,
          guesses: guessCount,
          points,
          winnerHits
        },
        streak,
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
                  gateway: true,
                  qrCode: true,
                  status: true,
                  transactionId: true
                },
                take: 1,
                where: {
                  gateway: "PIX",
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
    items: [],
    unread: 0
  };

  try {
    const filterValue = searchParams.filter;
    const filter = Array.isArray(filterValue) ? filterValue[0] : (filterValue ?? "all");
    const where = {
      userId,
      ...(filter === "unread" ? { readAt: null } : {}),
      ...(filter === "system" ? { type: "SYSTEM" as const } : {}),
      ...(filter === "payment" ? { type: "PAYMENT" as const } : {})
    };

    const [items, unread] = await prisma.$transaction([
      prisma.notification.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 50,
        where
      }),
      prisma.notification.count({
        where: {
          userId,
          readAt: null
        }
      })
    ]);

    return {
      ok: true as const,
      data: {
        filter,
        items,
        unread
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar suas notificacoes.", empty);
  }
}

export async function getUserAchievements(userId: string) {
  const empty = {
    achieved: [],
    locked: []
  };

  try {
    const [achievements, badges] = await prisma.$transaction([
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
      })
    ]);

    const achievedBadgeIds = new Set(achievements.map((achievement) => achievement.badgeId));

    return {
      ok: true as const,
      data: {
        achieved: achievements,
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
