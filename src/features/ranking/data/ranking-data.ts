import { RankingScope, type Prisma } from "@prisma/client";

import { prisma } from "@/server/db";

type SearchParams = Record<string, string | string[] | undefined>;

export type RankingScopeOption = RankingScope | "SEASON";

export type RankingRowView = {
  averageSubmitSeconds: number | null;
  currentStreak: number;
  exactScores: number;
  hits: number;
  id: string;
  losses: number;
  points: number;
  position: number | null;
  user: {
    avatarUrl: string | null;
    id: string;
    name: string;
    username: string;
  };
  wins: number;
};

export type RankingOption = {
  id: string;
  label: string;
};

export type RankingPageData = {
  filters: {
    leagueId: string;
    roundId: string;
    scope: RankingScopeOption;
    seasonId: string;
  };
  leagues: RankingOption[];
  myRanking: RankingRowView | null;
  rankings: RankingRowView[];
  rounds: RankingOption[];
  seasons: RankingOption[];
  stats: {
    leaderPoints: number;
    myPosition: number | null;
    rows: number;
  };
};

export type RankingDataResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      message: string;
      data: T;
    };

function getParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] : value;
}

function emptyResult<T>(message: string, data: T): RankingDataResult<T> {
  return {
    ok: false,
    message,
    data
  };
}

function isRankingScopeOption(value: string | undefined): value is RankingScopeOption {
  return value === "SEASON" || Object.values(RankingScope).includes(value as RankingScope);
}

export function getRankingScopeLabel(scope: RankingScopeOption) {
  const labels = {
    GLOBAL: "Geral",
    HISTORICAL: "Historico",
    LEAGUE: "Liga",
    MONTHLY: "Mensal",
    ROUND: "Rodada",
    SEASON: "Temporada"
  } satisfies Record<RankingScopeOption, string>;

  return labels[scope];
}

function mapRankingRow(
  row: Prisma.RankingGetPayload<{
    include: {
      user: {
        select: {
          avatarUrl: true;
          id: true;
          name: true;
          username: true;
        };
      };
    };
  }>
): RankingRowView {
  return {
    averageSubmitSeconds: row.averageSubmitSeconds,
    currentStreak: row.currentStreak,
    exactScores: row.exactScores,
    hits: row.hits,
    id: row.id,
    losses: row.losses,
    points: row.points,
    position: row.position,
    user: row.user,
    wins: row.wins
  };
}

function getRankingWhere(filters: RankingPageData["filters"]): Prisma.RankingWhereInput {
  if (filters.scope === "LEAGUE") {
    return {
      leagueId: filters.leagueId || "__none__",
      scope: "LEAGUE"
    };
  }

  if (filters.scope === "ROUND") {
    return {
      roundId: filters.roundId || "__none__",
      scope: "ROUND"
    };
  }

  if (filters.scope === "SEASON") {
    return {
      scope: "GLOBAL",
      seasonId: filters.seasonId || "__none__"
    };
  }

  return {
    leagueId: null,
    roundId: null,
    scope: filters.scope,
    seasonId: null
  };
}

async function getDefaultRoundId(userId: string) {
  const latestRoundRanking = await prisma.ranking.findFirst({
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      roundId: true
    },
    where: {
      roundId: {
        not: null
      },
      round: {
        league: {
          members: {
            some: {
              status: "ACTIVE",
              userId
            }
          }
        }
      },
      scope: "ROUND"
    }
  });

  return latestRoundRanking?.roundId ?? "";
}

async function getDefaultSeasonId(userId: string) {
  const latestSeasonRanking = await prisma.ranking.findFirst({
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      seasonId: true
    },
    where: {
      scope: "GLOBAL",
      season: {
        rounds: {
          some: {
            league: {
              members: {
                some: {
                  status: "ACTIVE",
                  userId
                }
              }
            }
          }
        }
      },
      seasonId: {
        not: null
      }
    }
  });

  return latestSeasonRanking?.seasonId ?? "";
}

export async function getRankingPageData(
  userId: string,
  searchParams: SearchParams
): Promise<RankingDataResult<RankingPageData>> {
  const empty: RankingPageData = {
    filters: {
      leagueId: "",
      roundId: "",
      scope: "GLOBAL",
      seasonId: ""
    },
    leagues: [],
    myRanking: null,
    rankings: [],
    rounds: [],
    seasons: [],
    stats: {
      leaderPoints: 0,
      myPosition: null,
      rows: 0
    }
  };

  try {
    const requestedScope = getParam(searchParams, "scope");
    const requestedScopeOption = isRankingScopeOption(requestedScope) ? requestedScope : undefined;

    const [memberships, rounds, seasons, defaultRoundId, defaultSeasonId] = await Promise.all([
      prisma.leagueMember.findMany({
        orderBy: {
          joinedAt: "desc"
        },
        select: {
          league: {
            select: {
              id: true,
              name: true
            }
          }
        },
        where: {
          status: "ACTIVE",
          userId
        }
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
        },
        take: 100,
        where: {
          league: {
            members: {
              some: {
                status: "ACTIVE",
                userId
              }
            }
          },
          rankings: {
            some: {
              scope: "ROUND"
            }
          }
        }
      }),
      prisma.season.findMany({
        orderBy: {
          year: "desc"
        },
        select: {
          championship: {
            select: {
              name: true
            }
          },
          id: true,
          name: true,
          year: true
        },
        take: 100,
        where: {
          rounds: {
            some: {
              league: {
                members: {
                  some: {
                    status: "ACTIVE",
                    userId
                  }
                }
              }
            }
          },
          rankings: {
            some: {
              scope: "GLOBAL"
            }
          }
        }
      }),
      getDefaultRoundId(userId),
      getDefaultSeasonId(userId)
    ]);

    const leagues = memberships.map((membership) => ({
      id: membership.league.id,
      label: membership.league.name
    }));
    const requestedLeagueId = getParam(searchParams, "league");
    const selectedLeagueId =
      leagues.find((league) => league.id === requestedLeagueId)?.id ?? leagues[0]?.id ?? "";
    const filters = {
      leagueId: selectedLeagueId,
      roundId: getParam(searchParams, "round") ?? defaultRoundId,
      scope: requestedScopeOption ?? (selectedLeagueId ? "LEAGUE" : "GLOBAL"),
      seasonId: getParam(searchParams, "season") ?? defaultSeasonId
    } satisfies RankingPageData["filters"];
    const where = getRankingWhere(filters);

    const [rankingRows, myRanking] = await prisma.$transaction([
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
        orderBy: [
          {
            position: "asc"
          },
          {
            points: "desc"
          }
        ],
        take: 100,
        where
      }),
      prisma.ranking.findFirst({
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
        where: {
          ...where,
          userId
        }
      })
    ]);

    const rankings = rankingRows.map(mapRankingRow);
    const myRankingView = myRanking ? mapRankingRow(myRanking) : null;

    return {
      ok: true,
      data: {
        filters,
        leagues,
        myRanking: myRankingView,
        rankings,
        rounds: rounds.map((round) => ({
          id: round.id,
          label: `${round.name || `Rodada ${round.number}`} - ${round.season.championship.name} ${round.season.name || round.season.year}`
        })),
        seasons: seasons.map((season) => ({
          id: season.id,
          label: `${season.championship.name} - ${season.name || season.year}`
        })),
        stats: {
          leaderPoints: rankings[0]?.points ?? 0,
          myPosition: myRankingView?.position ?? null,
          rows: rankings.length
        }
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar o ranking.", empty);
  }
}
