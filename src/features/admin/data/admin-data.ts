import type {
  AccountStatus,
  ChampionshipStatus,
  LeagueStatus,
  PaymentStatus,
  Prisma,
  RoundStatus,
  UserRole
} from "@prisma/client";

import { getSaoPauloDayRangeUtc, serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import {
  FOOTBALL_MANUAL_TRIGGER,
  isFootballAutomationRunning
} from "@/server/football-api/automation-service";
import { isFootballApiConfigured } from "@/server/football-api/client";
import {
  footballCompetitionConfigs,
  getFootballManualSyncCooldownHours,
  getFootballSyncCacheHours
} from "@/server/football-api/competitions";
import { getFootballApiUsageSnapshot } from "@/server/football-api/request";
import type { AdminDataResult } from "../types";

const DEFAULT_PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] : value;
}

function getPage(searchParams: SearchParams) {
  const page = Number(getParam(searchParams, "page") ?? "1");

  return Number.isFinite(page) && page > 0 ? page : 1;
}

function getPagination(searchParams: SearchParams) {
  const page = getPage(searchParams);

  return {
    page,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
    take: DEFAULT_PAGE_SIZE
  };
}

function emptyResult<T>(message: string, data: T): AdminDataResult<T> {
  return {
    ok: false,
    message,
    data
  };
}

function toCurrency(value: Prisma.Decimal | number | null | undefined) {
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

function todayRange() {
  return getSaoPauloDayRangeUtc();
}

export async function getAdminDashboardData() {
  const empty = {
    accessToday: 0,
    activeUsers: 0,
    errors: 0,
    leagues: 0,
    matches: 0,
    pendingPayments: 0,
    recentAuditLogs: [],
    recentUsers: [],
    revenue: "R$ 0,00",
    users: 0
  };

  try {
    const { end, start } = todayRange();
    const [
      users,
      activeUsers,
      leagues,
      matches,
      pendingPayments,
      revenue,
      accessToday,
      errors,
      recentUsers,
      recentAuditLogs
    ] = await prisma.$transaction([
      prisma.user.count({
        where: {
          deletedAt: null
        }
      }),
      prisma.user.count({
        where: {
          deletedAt: null,
          status: "ACTIVE"
        }
      }),
      prisma.league.count({
        where: {
          deletedAt: null
        }
      }),
      prisma.match.count({
        where: {
          deletedAt: null
        }
      }),
      prisma.payment.count({
        where: {
          status: "PENDING"
        }
      }),
      prisma.payment.aggregate({
        _sum: {
          amount: true
        },
        where: {
          status: "APPROVED"
        }
      }),
      prisma.auditLog.count({
        where: {
          action: "auth.login.success",
          createdAt: {
            gte: start,
            lt: end
          }
        }
      }),
      prisma.auditLog.count({
        where: {
          action: {
            contains: "error",
            mode: "insensitive"
          }
        }
      }),
      prisma.user.findMany({
        orderBy: {
          createdAt: "desc"
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true
        },
        take: 5
      }),
      prisma.auditLog.findMany({
        include: {
          user: {
            select: {
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 6
      })
    ]);

    return {
      ok: true as const,
      data: {
        accessToday,
        activeUsers,
        errors,
        leagues,
        matches,
        pendingPayments,
        recentAuditLogs,
        recentUsers,
        revenue: toCurrency(revenue._sum.amount),
        users
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar o painel administrativo.", empty);
  }
}

export async function getAdminUsers(searchParams: SearchParams) {
  const empty = {
    items: [],
    page: getPage(searchParams),
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0
  };

  try {
    const { page, skip, take } = getPagination(searchParams);
    const q = getParam(searchParams, "q");
    const role = getParam(searchParams, "role") as UserRole | undefined;
    const status = getParam(searchParams, "status") as AccountStatus | undefined;

    const where: Prisma.UserWhereInput = {
      ...(q
        ? {
            OR: [
              {
                name: {
                  contains: q,
                  mode: "insensitive"
                }
              },
              {
                email: {
                  contains: q,
                  mode: "insensitive"
                }
              },
              {
                username: {
                  contains: q,
                  mode: "insensitive"
                }
              },
              {
                phone: {
                  contains: q
                }
              }
            ]
          }
        : {}),
      ...(role ? { role } : {}),
      ...(status ? { status } : { deletedAt: null })
    };

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        orderBy: {
          createdAt: "desc"
        },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          xp: true,
          level: true,
          createdAt: true,
          lastLoginAt: true
        },
        skip,
        take,
        where
      }),
      prisma.user.count({
        where
      })
    ]);

    return {
      ok: true as const,
      data: {
        items,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        total
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar usuarios.", empty);
  }
}

export async function getAdminChampionships(searchParams: SearchParams) {
  const empty = {
    items: [],
    page: getPage(searchParams),
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0
  };

  try {
    const { page, skip, take } = getPagination(searchParams);
    const q = getParam(searchParams, "q");
    const status = getParam(searchParams, "status") as ChampionshipStatus | undefined;
    const where: Prisma.ChampionshipWhereInput = {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              {
                name: {
                  contains: q,
                  mode: "insensitive"
                }
              },
              {
                country: {
                  contains: q,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {}),
      ...(status ? { status } : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.championship.findMany({
        orderBy: {
          createdAt: "desc"
        },
        select: {
          id: true,
          name: true,
          country: true,
          status: true,
          provider: true,
          apiId: true,
          primaryColor: true,
          createdAt: true,
          _count: {
            select: {
              seasons: true
            }
          }
        },
        skip,
        take,
        where
      }),
      prisma.championship.count({
        where
      })
    ]);

    return {
      ok: true as const,
      data: {
        items,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        total
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar campeonatos.", empty);
  }
}

export async function getAdminTeams(searchParams: SearchParams) {
  const empty = {
    apiConfigured: isFootballApiConfigured(),
    items: [],
    page: getPage(searchParams),
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0
  };

  try {
    const { page, skip, take } = getPagination(searchParams);
    const q = getParam(searchParams, "q");
    const where: Prisma.TeamWhereInput = {
      ...(q
        ? {
            OR: [
              {
                name: {
                  contains: q,
                  mode: "insensitive"
                }
              },
              {
                shortName: {
                  contains: q,
                  mode: "insensitive"
                }
              },
              {
                country: {
                  contains: q,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.team.findMany({
        orderBy: [
          {
            country: "asc"
          },
          {
            name: "asc"
          }
        ],
        select: {
          apiId: true,
          country: true,
          createdAt: true,
          id: true,
          logo: true,
          name: true,
          shortName: true,
          _count: {
            select: {
              awayMatches: true,
              homeMatches: true
            }
          }
        },
        skip,
        take,
        where
      }),
      prisma.team.count({
        where
      })
    ]);

    return {
      ok: true as const,
      data: {
        apiConfigured: isFootballApiConfigured(),
        items,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        total
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar times.", empty);
  }
}

export async function getAdminRounds(searchParams: SearchParams) {
  const empty = {
    items: [],
    leagues: [],
    page: getPage(searchParams),
    pageSize: DEFAULT_PAGE_SIZE,
    roundOptions: [],
    seasons: [],
    teams: [],
    total: 0
  };

  try {
    const { page, skip, take } = getPagination(searchParams);
    const q = getParam(searchParams, "q");
    const status = getParam(searchParams, "status") as RoundStatus | undefined;
    const championshipId = getParam(searchParams, "championship");
    const leagueId = getParam(searchParams, "league");
    const scopeParam = getParam(searchParams, "roundScope");
    const roundScope = scopeParam === "base" || scopeParam === "all" ? scopeParam : "league";
    const where: Prisma.RoundWhereInput = {
      ...(q
        ? {
            OR: [
              {
                name: {
                  contains: q,
                  mode: "insensitive"
                }
              },
              {
                description: {
                  contains: q,
                  mode: "insensitive"
                }
              },
              {
                season: {
                  championship: {
                    name: {
                      contains: q,
                      mode: "insensitive"
                    }
                  }
                }
              }
            ]
          }
        : {}),
      ...(status ? { status } : {}),
      ...(leagueId
        ? { leagueId }
        : roundScope === "base"
          ? { leagueId: null }
          : roundScope === "league"
            ? { leagueId: { not: null } }
            : {}),
      ...(championshipId
        ? {
            season: {
              championshipId
            }
          }
        : {})
    };

    const [items, total, seasons, teams, roundOptions, leagues] = await prisma.$transaction([
      prisma.round.findMany({
        include: {
          league: {
            select: {
              championshipId: true,
              id: true,
              name: true,
              status: true
            }
          },
          matches: {
            include: {
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
              _count: {
                select: {
                  guesses: true,
                  scores: true
                }
              }
            },
            orderBy: {
              kickoff: "asc"
            },
            take: 12,
            where: {
              deletedAt: null
            }
          },
          season: {
            include: {
              championship: {
                select: {
                  id: true,
                  name: true,
                  status: true
                }
              }
            }
          },
          _count: {
            select: {
              matches: true,
              rankings: true
            }
          }
        },
        orderBy: [
          {
            startsAt: "desc"
          },
          {
            number: "desc"
          }
        ],
        skip,
        take,
        where
      }),
      prisma.round.count({
        where
      }),
      prisma.season.findMany({
        include: {
          championship: {
            select: {
              id: true,
              name: true,
              status: true
            }
          }
        },
        orderBy: [
          {
            year: "desc"
          }
        ],
        take: 200,
        where: {
          championship: {
            deletedAt: null
          }
        }
      }),
      prisma.team.findMany({
        orderBy: {
          name: "asc"
        },
        select: {
          country: true,
          id: true,
          name: true,
          shortName: true
        },
        take: 500
      }),
      prisma.round.findMany({
        orderBy: [
          {
            startsAt: "desc"
          },
          {
            number: "desc"
          }
        ],
        select: {
          id: true,
          name: true,
          number: true,
          league: {
            select: {
              championshipId: true,
              id: true,
              name: true
            }
          },
          season: {
            select: {
              championship: {
                select: {
                  name: true
                }
              },
              name: true,
              year: true
            }
          },
          status: true
        },
        take: 200,
        where: {
          leagueId: {
            not: null
          },
          season: {
            championship: {
              deletedAt: null
            }
          }
        }
      }),
      prisma.league.findMany({
        orderBy: {
          name: "asc"
        },
        select: {
          championship: {
            select: {
              id: true,
              name: true
            }
          },
          championshipId: true,
          id: true,
          name: true,
          status: true
        },
        take: 500,
        where: {
          deletedAt: null
        }
      })
    ]);

    return {
      ok: true as const,
      data: {
        items,
        leagues,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        roundOptions,
        seasons,
        teams,
        total
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar rodadas.", empty);
  }
}

export async function getAdminLeagues(searchParams: SearchParams) {
  const empty = {
    championshipOptions: [],
    items: [],
    page: getPage(searchParams),
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0
  };

  try {
    const { page, skip, take } = getPagination(searchParams);
    const q = getParam(searchParams, "q");
    const championshipId = getParam(searchParams, "championship");
    const status = getParam(searchParams, "status") as LeagueStatus | undefined;
    const where: Prisma.LeagueWhereInput = {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              {
                name: {
                  contains: q,
                  mode: "insensitive"
                }
              },
              {
                owner: {
                  email: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              }
            ]
          }
        : {}),
      ...(championshipId ? { championshipId } : {}),
      ...(status ? { status } : {})
    };

    const [items, total, championshipOptions] = await prisma.$transaction([
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
        skip,
        take,
        where
      }),
      prisma.league.count({
        where
      }),
      prisma.championship.findMany({
        orderBy: {
          name: "asc"
        },
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
        },
        where: {
          deletedAt: null,
          status: "ACTIVE"
        }
      })
    ]);

    return {
      ok: true as const,
      data: {
        championshipOptions: championshipOptions.map((championship) => {
          const season = championship.seasons[0];

          return {
            country: championship.country,
            id: championship.id,
            label: `${championship.name}${season ? ` ${season.name || season.year}` : ""}`,
            logo: championship.logo
          };
        }),
        items,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        total
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar ligas.", empty);
  }
}

export async function getAdminLeagueRankings(searchParams: SearchParams) {
  const empty = {
    adjustments: [],
    leagues: [],
    participants: [],
    rankings: [],
    selectedLeague: null,
    selectedLeagueId: ""
  };

  try {
    const leagues = await prisma.league.findMany({
      orderBy: {
        name: "asc"
      },
      select: {
        championship: {
          select: {
            id: true,
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
        id: true,
        name: true,
        status: true,
        _count: {
          select: {
            members: true
          }
        }
      },
      where: {
        deletedAt: null,
        status: {
          not: "ARCHIVED"
        }
      }
    });
    const leagueOptions = leagues.map((league) => {
      const season = league.championship.seasons[0];

      return {
        championshipId: league.championship.id,
        championshipName: league.championship.name,
        id: league.id,
        label: `${league.name} - ${league.championship.name}${season ? ` ${season.name || season.year}` : ""}`,
        membersCount: league._count.members,
        name: league.name,
        status: league.status
      };
    });
    const requestedLeagueId = getParam(searchParams, "league");
    const selectedLeagueId =
      leagueOptions.find((league) => league.id === requestedLeagueId)?.id ??
      leagueOptions[0]?.id ??
      "";

    if (!selectedLeagueId) {
      return {
        ok: true as const,
        data: {
          ...empty,
          leagues: leagueOptions
        }
      };
    }

    const selectedChampionshipId = leagueOptions.find(
      (league) => league.id === selectedLeagueId
    )?.championshipId;

    const [rankings, participants, adjustments, allAdjustments, emblemAwards] =
      await prisma.$transaction([
        prisma.ranking.findMany({
          include: {
            user: {
              select: {
                avatarUrl: true,
                email: true,
                id: true,
                level: true,
                name: true,
                username: true,
                xp: true
              }
            }
          },
          orderBy: [
            {
              position: "asc"
            },
            {
              points: "desc"
            }
          ],
          where: {
            leagueId: selectedLeagueId,
            scope: "LEAGUE"
          }
        }),
        prisma.leagueMember.findMany({
          orderBy: {
            user: {
              name: "asc"
            }
          },
          select: {
            user: {
              select: {
                avatarUrl: true,
                email: true,
                id: true,
                name: true,
                username: true
              }
            }
          },
          where: {
            leagueId: selectedLeagueId,
            status: "ACTIVE"
          }
        }),
        prisma.rankingAdjustment.findMany({
          orderBy: {
            createdAt: "desc"
          },
          select: {
            admin: {
              select: {
                email: true,
                name: true
              }
            },
            createdAt: true,
            id: true,
            pointsDelta: true,
            reason: true,
            user: {
              select: {
                avatarUrl: true,
                email: true,
                id: true,
                name: true,
                username: true
              }
            }
          },
          take: 20,
          where: {
            leagueId: selectedLeagueId
          }
        }),
        prisma.rankingAdjustment.findMany({
          select: {
            pointsDelta: true,
            userId: true
          },
          where: {
            leagueId: selectedLeagueId
          }
        }),
        prisma.leagueBadgeAward.findMany({
          include: {
            badge: { select: { title: true } },
            championship: { select: { name: true } }
          },
          orderBy: { createdAt: "desc" },
          where: {
            OR: [
              {
                championshipId: selectedChampionshipId ?? "00000000-0000-0000-0000-000000000000"
              },
              { isUniversal: true }
            ]
          }
        })
      ]);
    const adjustmentTotals = allAdjustments.reduce<Map<string, number>>(
      (accumulator, adjustment) => {
        accumulator.set(
          adjustment.userId,
          (accumulator.get(adjustment.userId) ?? 0) + adjustment.pointsDelta
        );

        return accumulator;
      },
      new Map<string, number>()
    );
    const emblemsByUser = emblemAwards.reduce<Map<string, typeof emblemAwards>>((map, award) => {
      const current = map.get(award.userId) ?? [];
      current.push(award);
      map.set(award.userId, current);
      return map;
    }, new Map());

    return {
      ok: true as const,
      data: {
        adjustments,
        leagues: leagueOptions,
        participants: participants.map((participant) => participant.user),
        rankings: rankings.map((ranking) => ({
          ...ranking,
          adjustmentPoints: adjustmentTotals.get(ranking.userId) ?? 0,
          emblems: emblemsByUser.get(ranking.userId) ?? []
        })),
        selectedLeague: leagueOptions.find((league) => league.id === selectedLeagueId) ?? null,
        selectedLeagueId
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar rankings por liga.", empty);
  }
}

export async function getAdminPayments(searchParams: SearchParams) {
  const empty = {
    items: [],
    page: getPage(searchParams),
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0
  };

  try {
    const { page, skip, take } = getPagination(searchParams);
    const status = getParam(searchParams, "status") as PaymentStatus | undefined;
    const q = getParam(searchParams, "q");
    const where: Prisma.PaymentWhereInput = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              {
                user: {
                  email: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              },
              {
                league: {
                  name: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              },
              {
                transactionId: {
                  contains: q,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.payment.findMany({
        include: {
          league: {
            select: {
              name: true
            }
          },
          user: {
            select: {
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        skip,
        take,
        where
      }),
      prisma.payment.count({
        where
      })
    ]);

    return {
      ok: true as const,
      data: {
        items,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        total
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar pagamentos.", empty);
  }
}

export async function getAdminGuesses(searchParams: SearchParams) {
  const empty = {
    items: [],
    page: getPage(searchParams),
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0
  };

  try {
    const { page, skip, take } = getPagination(searchParams);
    const q = getParam(searchParams, "q");
    const where: Prisma.GuessWhereInput = {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              {
                user: {
                  name: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              },
              {
                user: {
                  email: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              },
              {
                league: {
                  name: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              },
              {
                match: {
                  homeTeam: {
                    name: {
                      contains: q,
                      mode: "insensitive"
                    }
                  }
                }
              },
              {
                match: {
                  awayTeam: {
                    name: {
                      contains: q,
                      mode: "insensitive"
                    }
                  }
                }
              }
            ]
          }
        : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.guess.findMany({
        orderBy: {
          submittedAt: "desc"
        },
        select: {
          awayPrediction: true,
          homePrediction: true,
          id: true,
          joker: true,
          league: {
            select: {
              name: true
            }
          },
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
                  name: true,
                  number: true,
                  season: {
                    select: {
                      championship: {
                        select: {
                          name: true
                        }
                      },
                      name: true,
                      year: true
                    }
                  }
                }
              },
              status: true
            }
          },
          prediction: true,
          score: {
            select: {
              exactScore: true,
              totalPoints: true,
              winnerHit: true
            }
          },
          submittedAt: true,
          updatedAt: true,
          user: {
            select: {
              avatarUrl: true,
              email: true,
              name: true,
              username: true
            }
          }
        },
        skip,
        take,
        where
      }),
      prisma.guess.count({
        where
      })
    ]);

    return {
      ok: true as const,
      data: {
        items,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        total
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar palpites.", empty);
  }
}

export async function getAdminAuditLogs(searchParams: SearchParams) {
  const empty = {
    items: [],
    page: getPage(searchParams),
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0
  };

  try {
    const { page, skip, take } = getPagination(searchParams);
    const q = getParam(searchParams, "q");
    const entity = getParam(searchParams, "entity");
    const action = getParam(searchParams, "action");
    const where: Prisma.AuditLogWhereInput = {
      ...(entity ? { entity } : {}),
      ...(action
        ? {
            action: {
              contains: action,
              mode: "insensitive"
            }
          }
        : {}),
      ...(q
        ? {
            OR: [
              {
                user: {
                  email: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              },
              {
                user: {
                  name: {
                    contains: q,
                    mode: "insensitive"
                  }
                }
              },
              {
                entityId: {
                  contains: q,
                  mode: "insensitive"
                }
              }
            ]
          }
        : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        include: {
          user: {
            select: {
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        skip,
        take,
        where
      }),
      prisma.auditLog.count({
        where
      })
    ]);

    return {
      ok: true as const,
      data: {
        items,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        total
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar auditoria.", empty);
  }
}

export async function getAdminSettings() {
  const fallback = {
    currency: "BRL",
    footballApiProvider: "",
    language: "pt-BR",
    platformName: "Bolao do Lobo",
    supportEmail: "",
    timezone: "America/Sao_Paulo"
  };

  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: Object.keys(fallback)
        }
      }
    });

    return {
      ok: true as const,
      data: settings.reduce((acc, setting) => {
        return {
          ...acc,
          [setting.key]: typeof setting.value === "string" ? setting.value : String(setting.value)
        };
      }, fallback)
    };
  } catch {
    return emptyResult("Nao foi possivel carregar configuracoes.", fallback);
  }
}

export async function getAdminFootballSyncStatus() {
  const empty = {
    apiConfigured: isFootballApiConfigured(),
    automation: null,
    cacheHours: getFootballSyncCacheHours(),
    competitions: footballCompetitionConfigs.map((competition) => ({
      ...competition,
      lastAttempt: null,
      lastSuccess: null,
      local: {
        matches: 0,
        rounds: 0,
        standings: 0
      }
    })),
    detailMatches: [],
    manual: {
      canRun: false,
      cooldownHours: getFootballManualSyncCooldownHours(),
      lastRun: null,
      nextAvailableAt: null
    },
    recentRuns: [],
    usage: {
      callsToday: 0,
      dailyLimit: null,
      dailyRemaining: null,
      recentErrors: []
    }
  };

  try {
    const automationRunning = await isFootballAutomationRunning();
    const competitionKeys = footballCompetitionConfigs.map((competition) => competition.key);
    const [
      logs,
      championships,
      automation,
      recentRuns,
      usage,
      latestManualRun,
      detailMatchesByCompetition
    ] = await Promise.all([
      prisma.footballSyncLog.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 100,
        where: {
          competitionKey: {
            in: competitionKeys
          }
        }
      }),
      prisma.championship.findMany({
        include: {
          seasons: {
            include: {
              _count: {
                select: {
                  rounds: {
                    where: {
                      leagueId: null
                    }
                  },
                  standings: true
                }
              }
            }
          }
        },
        where: {
          apiId: {
            in: footballCompetitionConfigs.map((competition) => competition.leagueId)
          },
          provider: "api-football"
        }
      }),
      prisma.footballSyncState.findUnique({
        where: {
          key: "api-football-automatic"
        }
      }),
      prisma.footballAutomationLog.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 10
      }),
      getFootballApiUsageSnapshot(),
      prisma.footballAutomationLog.findFirst({
        orderBy: {
          startedAt: "desc"
        },
        where: {
          trigger: FOOTBALL_MANUAL_TRIGGER,
          OR: [{ status: "SUCCESS" }, { callsUsed: { gt: 0 } }]
        }
      }),
      Promise.all(
        footballCompetitionConfigs.map((competition) =>
          prisma.match.findMany({
            orderBy: { kickoff: "desc" },
            select: {
              apiId: true,
              awayTeam: { select: { name: true } },
              eventsSyncedAt: true,
              fullySyncedAt: true,
              historySyncedAt: true,
              homeTeam: { select: { name: true } },
              id: true,
              kickoff: true,
              lineupsSyncedAt: true,
              playersSyncedAt: true,
              round: { select: { name: true, number: true } },
              statisticsSyncedAt: true,
              status: true
            },
            take: 120,
            where: {
              apiId: { not: null },
              deletedAt: null,
              kickoff: {
                gte: new Date(serverNow().getTime() - 30 * 86_400_000),
                lte: new Date(serverNow().getTime() + 45 * 86_400_000)
              },
              round: {
                leagueId: null,
                season: {
                  championship: {
                    apiId: competition.leagueId,
                    provider: "api-football"
                  },
                  year: competition.season
                }
              }
            }
          })
        )
      )
    ]);

    const competitions = await Promise.all(
      footballCompetitionConfigs.map(async (competition) => {
        const lastAttempt =
          logs.find(
            (log) => log.competitionKey === competition.key && log.season === competition.season
          ) ?? null;
        const lastSuccess =
          logs.find(
            (log) =>
              log.competitionKey === competition.key &&
              log.season === competition.season &&
              log.status === "SUCCESS"
          ) ?? null;
        const championship = championships.find(
          (item) => item.apiId === competition.leagueId && item.provider === "api-football"
        );
        const season = championship?.seasons.find((item) => item.year === competition.season);
        const matches = season
          ? await prisma.match.count({
              where: {
                deletedAt: null,
                round: {
                  leagueId: null,
                  seasonId: season.id
                }
              }
            })
          : 0;

        return {
          ...competition,
          lastAttempt,
          lastSuccess,
          local: {
            matches,
            rounds: season?._count.rounds ?? 0,
            standings: season?._count.standings ?? 0
          }
        };
      })
    );
    const cooldownHours = getFootballManualSyncCooldownHours();
    const nextAvailableAt = latestManualRun
      ? new Date(latestManualRun.startedAt.getTime() + cooldownHours * 60 * 60_000)
      : null;
    const now = serverNow();
    const detailMatches = detailMatchesByCompetition.flatMap((matches, index) => {
      const competition = footballCompetitionConfigs[index];

      return matches.map((match) => ({
        apiId: match.apiId as number,
        awayTeamName: match.awayTeam.name,
        competitionKey: competition.key,
        detailStatus: match.fullySyncedAt
          ? "Completo"
          : [
                match.historySyncedAt,
                match.lineupsSyncedAt,
                match.eventsSyncedAt,
                match.statisticsSyncedAt,
                match.playersSyncedAt
              ].some(Boolean)
            ? "Parcial"
            : "Pendente",
        homeTeamName: match.homeTeam.name,
        id: match.id,
        kickoff: match.kickoff.toISOString(),
        roundLabel: match.round.name || `Rodada ${match.round.number}`,
        status: match.status
      }));
    });

    return {
      ok: true as const,
      data: {
        apiConfigured: isFootballApiConfigured(),
        automation,
        cacheHours: getFootballSyncCacheHours(),
        competitions,
        detailMatches,
        manual: {
          canRun:
            isFootballApiConfigured() &&
            !automationRunning &&
            (!nextAvailableAt || nextAvailableAt <= now),
          cooldownHours,
          lastRun: latestManualRun,
          nextAvailableAt
        },
        recentRuns,
        usage
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar sincronizacoes.", empty);
  }
}

export async function getAdminXpData() {
  const empty = {
    awardSuggestions: [],
    awards: [],
    events: [],
    badges: [],
    championships: [],
    levels: [],
    leagues: [],
    missions: [],
    paidLeagueMinimumEntryFee: 1,
    stats: {
      totalEvents: 0,
      totalXp: 0,
      usersWithXp: 0
    },
    typeConfigs: [],
    users: []
  };

  try {
    const [
      levels,
      typeConfigs,
      events,
      users,
      leagues,
      championships,
      missions,
      settings,
      badges,
      eventCount,
      xpAggregate,
      usersWithXp,
      awards,
      leagueRankings
    ] = await prisma.$transaction([
      prisma.xpLevel.findMany({
        orderBy: {
          sortOrder: "asc"
        }
      }),
      prisma.xpTypeConfig.findMany({
        orderBy: {
          key: "asc"
        }
      }),
      prisma.xpEvent.findMany({
        include: {
          admin: {
            select: {
              email: true,
              name: true
            }
          },
          league: {
            select: {
              name: true
            }
          },
          user: {
            select: {
              avatarUrl: true,
              email: true,
              name: true,
              username: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 30
      }),
      prisma.user.findMany({
        orderBy: [
          {
            xp: "desc"
          },
          {
            name: "asc"
          }
        ],
        select: {
          avatarUrl: true,
          email: true,
          id: true,
          level: true,
          name: true,
          username: true,
          xp: true
        },
        take: 100,
        where: {
          deletedAt: null
        }
      }),
      prisma.league.findMany({
        orderBy: {
          name: "asc"
        },
        select: {
          championship: {
            select: {
              name: true
            }
          },
          id: true,
          name: true,
          status: true,
          xpEnabled: true
        },
        where: {
          deletedAt: null,
          status: {
            not: "ARCHIVED"
          }
        }
      }),
      prisma.championship.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          logo: true,
          name: true,
          seasons: {
            orderBy: { year: "desc" },
            select: { name: true, year: true },
            take: 1
          },
          leagues: {
            select: {
              members: {
                select: { userId: true },
                where: { status: "ACTIVE" }
              }
            },
            where: {
              deletedAt: null,
              status: { not: "ARCHIVED" }
            }
          }
        },
        where: {
          deletedAt: null,
          status: "ACTIVE"
        }
      }),
      prisma.mission.findMany({
        orderBy: {
          startsAt: "desc"
        },
        take: 20
      }),
      prisma.setting.findUnique({
        select: {
          value: true
        },
        where: {
          key: "paidLeagueMinimumEntryFee"
        }
      }),
      prisma.badge.findMany({
        orderBy: {
          title: "asc"
        },
        take: 50
      }),
      prisma.xpEvent.count(),
      prisma.xpEvent.aggregate({
        _sum: {
          amount: true
        }
      }),
      prisma.user.count({
        where: {
          xp: {
            gt: 0
          }
        }
      }),
      prisma.leagueBadgeAward.findMany({
        include: {
          awardedBy: { select: { name: true } },
          badge: true,
          championship: { select: { logo: true, name: true } },
          league: { select: { name: true } },
          user: { select: { avatarUrl: true, email: true, name: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      prisma.ranking.findMany({
        orderBy: [{ leagueId: "asc" }, { position: "asc" }, { points: "desc" }],
        select: {
          exactScores: true,
          hits: true,
          league: { select: { id: true, name: true } },
          points: true,
          position: true,
          user: { select: { id: true, name: true } }
        },
        where: { leagueId: { not: null }, scope: "LEAGUE" }
      })
    ]);

    const settingValue = settings?.value;
    const paidLeagueMinimumEntryFee =
      typeof settingValue === "number"
        ? settingValue
        : typeof settingValue === "string"
          ? Number(settingValue)
          : 1;
    const rankingsByLeague = leagueRankings.reduce<Map<string, typeof leagueRankings>>(
      (map, ranking) => {
        if (!ranking.league) {
          return map;
        }

        const rows = map.get(ranking.league.id) ?? [];
        rows.push(ranking);
        map.set(ranking.league.id, rows);
        return map;
      },
      new Map()
    );
    const awardSuggestions = Array.from(rankingsByLeague.values()).flatMap((rankings) => {
      const league = rankings[0]?.league;

      if (!league || rankings.length === 0) {
        return [];
      }

      const byPosition = [...rankings].sort(
        (left, right) => (left.position ?? 9999) - (right.position ?? 9999)
      );
      const mostHits = [...rankings].sort(
        (left, right) => right.hits - left.hits || right.points - left.points
      )[0];
      const mostExact = [...rankings].sort(
        (left, right) => right.exactScores - left.exactScores || right.points - left.points
      )[0];

      return [
        byPosition[0]
          ? {
              category: "CHAMPION" as const,
              label: "Campeao atual",
              leagueId: league.id,
              leagueName: league.name,
              metric: `${byPosition[0].points} pontos`,
              userId: byPosition[0].user.id,
              userName: byPosition[0].user.name
            }
          : null,
        byPosition[1]
          ? {
              category: "RUNNER_UP" as const,
              label: "Vice atual",
              leagueId: league.id,
              leagueName: league.name,
              metric: `${byPosition[1].points} pontos`,
              userId: byPosition[1].user.id,
              userName: byPosition[1].user.name
            }
          : null,
        mostHits
          ? {
              category: "MOST_HITS" as const,
              label: "Mais resultados corretos",
              leagueId: league.id,
              leagueName: league.name,
              metric: `${mostHits.hits} acertos`,
              userId: mostHits.user.id,
              userName: mostHits.user.name
            }
          : null,
        mostExact
          ? {
              category: "MOST_EXACT_SCORES" as const,
              label: "Mais placares exatos",
              leagueId: league.id,
              leagueName: league.name,
              metric: `${mostExact.exactScores} exatos`,
              userId: mostExact.user.id,
              userName: mostExact.user.name
            }
          : null
      ].filter((suggestion): suggestion is NonNullable<typeof suggestion> => Boolean(suggestion));
    });

    return {
      ok: true as const,
      data: {
        awardSuggestions,
        awards,
        badges,
        championships: championships.map((championship) => {
          const season = championship.seasons[0];

          return {
            id: championship.id,
            label: `${championship.name}${season ? ` ${season.name || season.year}` : ""}`,
            logo: championship.logo,
            participantIds: [
              ...new Set(
                championship.leagues.flatMap((league) =>
                  league.members.map((member) => member.userId)
                )
              )
            ]
          };
        }),
        events,
        levels,
        leagues,
        missions,
        paidLeagueMinimumEntryFee: Number.isFinite(paidLeagueMinimumEntryFee)
          ? paidLeagueMinimumEntryFee
          : 1,
        stats: {
          totalEvents: eventCount,
          totalXp: xpAggregate._sum.amount ?? 0,
          usersWithXp
        },
        typeConfigs,
        users
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar administracao de XP.", empty);
  }
}

export { toCurrency };
