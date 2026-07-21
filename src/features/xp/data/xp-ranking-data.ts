import { prisma } from "@/server/db";
import type { LeagueEmblemView } from "@/features/xp/components/league-emblem";
import { getActiveXpLevels, getLevelForXp, type XpLevelView } from "../services/xp-service";

type SearchParams = Record<string, string | string[] | undefined>;

export type XpRankingRow = {
  emblems: LeagueEmblemView[];
  level: XpLevelView;
  position: number;
  user: {
    avatarUrl: string | null;
    id: string;
    name: string;
    username: string;
    xp: number;
  };
  xp: number;
};

export type XpRankingOption = {
  id: string;
  label: string;
};

export type XpRankingData = {
  filters: {
    leagueId: string;
    scope: "global" | "league" | "season";
    seasonId: string;
  };
  leagues: XpRankingOption[];
  rows: XpRankingRow[];
  seasons: XpRankingOption[];
  stats: {
    leaderXp: number;
    myPosition: number | null;
    rows: number;
  };
};

export type XpRankingDataResult<T> =
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

function emptyResult<T>(message: string, data: T): XpRankingDataResult<T> {
  return {
    ok: false,
    message,
    data
  };
}

function buildRows(
  users: Array<{
    avatarUrl: string | null;
    id: string;
    name: string;
    username: string;
    xp: number;
  }>,
  xpByUser: Map<string, number>,
  levels: XpLevelView[]
) {
  return users
    .map((user) => ({
      emblems: [],
      level: getLevelForXp(user.xp, levels),
      user,
      xp: xpByUser.get(user.id) ?? 0
    }))
    .sort((a, b) => b.xp - a.xp || a.user.name.localeCompare(b.user.name))
    .map((row, index) => ({
      ...row,
      position: index + 1
    }));
}

async function getUserOptions(userId: string) {
  const memberships = await prisma.leagueMember.findMany({
    orderBy: {
      joinedAt: "desc"
    },
    select: {
      league: {
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
                  id: true,
                  championshipId: true,
                  name: true,
                  year: true
                },
                take: 3
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

  const leagues = memberships.map((membership) => ({
    championshipId: membership.league.championship.id,
    id: membership.league.id,
    label: `${membership.league.name} - ${membership.league.championship.name}`
  }));
  const seasonMap = new Map<string, { championshipId: string; label: string }>();

  for (const membership of memberships) {
    for (const season of membership.league.championship.seasons) {
      seasonMap.set(season.id, {
        championshipId: season.championshipId,
        label: `${membership.league.championship.name} ${season.name || season.year}`
      });
    }
  }

  return {
    leagues,
    seasons: [...seasonMap.entries()].map(([id, value]) => ({ id, ...value }))
  };
}

export async function getXpRankingData(
  userId: string,
  searchParams: SearchParams
): Promise<XpRankingDataResult<XpRankingData>> {
  const empty: XpRankingData = {
    filters: {
      leagueId: "",
      scope: "global",
      seasonId: ""
    },
    leagues: [],
    rows: [],
    seasons: [],
    stats: {
      leaderXp: 0,
      myPosition: null,
      rows: 0
    }
  };

  try {
    const [levels, options] = await Promise.all([getActiveXpLevels(), getUserOptions(userId)]);
    const requestedScope = getParam(searchParams, "scope");
    const scope =
      requestedScope === "league" || requestedScope === "season" ? requestedScope : "global";
    const selectedLeagueId =
      options.leagues.find((league) => league.id === getParam(searchParams, "league"))?.id ??
      options.leagues[0]?.id ??
      "";
    const selectedSeasonId =
      options.seasons.find((season) => season.id === getParam(searchParams, "season"))?.id ??
      options.seasons[0]?.id ??
      "";

    let rows: XpRankingRow[] = [];

    if (scope === "league" && selectedLeagueId) {
      const [members, aggregates] = await prisma.$transaction([
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
                id: true,
                name: true,
                username: true,
                xp: true
              }
            }
          },
          where: {
            leagueId: selectedLeagueId,
            status: "ACTIVE"
          }
        }),
        prisma.xpEvent.groupBy({
          _sum: {
            amount: true
          },
          by: ["userId"],
          orderBy: {
            userId: "asc"
          },
          where: {
            leagueId: selectedLeagueId
          }
        })
      ]);
      const xpByUser = new Map(aggregates.map((item) => [item.userId, item._sum?.amount ?? 0]));

      rows = buildRows(
        members.map((member) => member.user),
        xpByUser,
        levels
      );
    } else if (scope === "season" && selectedSeasonId) {
      const aggregates = await prisma.xpEvent.groupBy({
        _sum: {
          amount: true
        },
        by: ["userId"],
        orderBy: {
          _sum: {
            amount: "desc"
          }
        },
        take: 100,
        where: {
          seasonId: selectedSeasonId
        }
      });
      const users = await prisma.user.findMany({
        orderBy: {
          name: "asc"
        },
        select: {
          avatarUrl: true,
          id: true,
          name: true,
          username: true,
          xp: true
        },
        where: {
          deletedAt: null,
          id: {
            in: aggregates.map((item) => item.userId)
          }
        }
      });
      const xpByUser = new Map(aggregates.map((item) => [item.userId, item._sum?.amount ?? 0]));

      rows = buildRows(users, xpByUser, levels);
    } else {
      const users = await prisma.user.findMany({
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
          id: true,
          name: true,
          username: true,
          xp: true
        },
        take: 100,
        where: {
          deletedAt: null,
          status: "ACTIVE"
        }
      });
      const xpByUser = new Map(users.map((user) => [user.id, user.xp]));

      rows = buildRows(users, xpByUser, levels);
    }

    if (rows.length > 0) {
      const selectedChampionshipId =
        scope === "league"
          ? options.leagues.find((league) => league.id === selectedLeagueId)?.championshipId
          : scope === "season"
            ? options.seasons.find((season) => season.id === selectedSeasonId)?.championshipId
            : undefined;
      const emblemAwards = await prisma.leagueBadgeAward.findMany({
        include: {
          badge: { select: { title: true } },
          championship: { select: { name: true } }
        },
        orderBy: { createdAt: "desc" },
        where: {
          ...(selectedChampionshipId
            ? {
                OR: [{ championshipId: selectedChampionshipId }, { isUniversal: true }]
              }
            : {}),
          userId: { in: rows.map((row) => row.user.id) }
        }
      });
      const emblemsByUser = emblemAwards.reduce<Map<string, LeagueEmblemView[]>>((map, award) => {
        const current = map.get(award.userId) ?? [];
        current.push(award);
        map.set(award.userId, current);
        return map;
      }, new Map());

      rows = rows.map((row) => ({
        ...row,
        emblems: emblemsByUser.get(row.user.id) ?? []
      }));
    }

    const myRow = rows.find((row) => row.user.id === userId) ?? null;

    return {
      ok: true,
      data: {
        filters: {
          leagueId: selectedLeagueId,
          scope,
          seasonId: selectedSeasonId
        },
        leagues: options.leagues,
        rows,
        seasons: options.seasons,
        stats: {
          leaderXp: rows[0]?.xp ?? 0,
          myPosition: myRow?.position ?? null,
          rows: rows.length
        }
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar o ranking de XP.", empty);
  }
}
