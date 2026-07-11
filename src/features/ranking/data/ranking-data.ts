import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";

type SearchParams = Record<string, string | string[] | undefined>;

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
    level: number;
    name: string;
    username: string;
    xp: number;
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

function mapRankingRow(
  row: Prisma.RankingGetPayload<{
    include: {
      user: {
        select: {
          avatarUrl: true;
          id: true;
          level: true;
          name: true;
          username: true;
          xp: true;
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

export async function getRankingPageData(
  userId: string,
  searchParams: SearchParams
): Promise<RankingDataResult<RankingPageData>> {
  const empty: RankingPageData = {
    filters: {
      leagueId: ""
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
    const memberships = await prisma.leagueMember.findMany({
      orderBy: {
        joinedAt: "desc"
      },
      select: {
        league: {
          select: {
            championship: {
              select: {
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
            name: true
          }
        }
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
        status: "ACTIVE",
        userId
      }
    });

    const leagues = memberships.map((membership) => {
      const season = membership.league.championship.seasons[0];
      const seasonLabel = season ? ` ${season.name || season.year}` : "";

      return {
        id: membership.league.id,
        label: `${membership.league.name} - ${membership.league.championship.name}${seasonLabel}`
      };
    });
    const requestedLeagueId = getParam(searchParams, "league");
    const selectedLeagueId =
      leagues.find((league) => league.id === requestedLeagueId)?.id ?? leagues[0]?.id ?? "";

    if (!selectedLeagueId) {
      return {
        ok: true,
        data: {
          ...empty,
          leagues
        }
      };
    }

    const where: Prisma.RankingWhereInput = {
      leagueId: selectedLeagueId,
      scope: "LEAGUE"
    };
    const [rankingRows, myRanking] = await prisma.$transaction([
      prisma.ranking.findMany({
        include: {
          user: {
            select: {
              avatarUrl: true,
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
        take: 100,
        where
      }),
      prisma.ranking.findFirst({
        include: {
          user: {
            select: {
              avatarUrl: true,
              id: true,
              level: true,
              name: true,
              username: true,
              xp: true
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
        filters: {
          leagueId: selectedLeagueId
        },
        leagues,
        myRanking: myRankingView,
        rankings,
        rounds: [],
        seasons: [],
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
