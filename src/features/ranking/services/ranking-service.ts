import { Prisma, type RankingScope } from "@prisma/client";

import { prisma } from "@/server/db";

type RankingContext = {
  leagueId?: string | null;
  roundId?: string | null;
  scope: RankingScope;
  seasonId?: string | null;
};

type RankingRowInput = Prisma.RankingCreateManyInput;

type RankingAdjustmentInput = {
  pointsDelta: number;
  userId: string;
};

const scoreSelect = {
  exactScore: true,
  leagueId: true,
  guess: {
    select: {
      submittedAt: true
    }
  },
  match: {
    select: {
      kickoff: true,
      round: {
        select: {
          seasonId: true
        }
      },
      roundId: true
    }
  },
  totalPoints: true,
  userId: true,
  winnerHit: true
} satisfies Prisma.ScoreSelect;

type ScoreRecord = Prisma.ScoreGetPayload<{ select: typeof scoreSelect }>;

export type RankingRecalculationSummary = {
  globalRows: number;
  historicalRows: number;
  leagueRows: number;
  monthlyRows: number;
  roundRows: number;
  seasonRows: number;
};

export function getMonthRange(date: Date) {
  const start = new Date(date);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  return {
    end,
    start
  };
}

export function getCurrentStreak(scores: ScoreRecord[]) {
  const sortedScores = scores
    .slice()
    .sort((a, b) => b.match.kickoff.getTime() - a.match.kickoff.getTime());
  let streak = 0;

  for (const score of sortedScores) {
    if (!score.winnerHit) {
      break;
    }

    streak += 1;
  }

  return streak;
}

export function getAverageSubmitSeconds(scores: ScoreRecord[]) {
  if (scores.length === 0) {
    return null;
  }

  const totalSeconds = scores.reduce((sum, score) => {
    const seconds = Math.max(
      0,
      Math.round((score.match.kickoff.getTime() - score.guess.submittedAt.getTime()) / 1000)
    );

    return sum + seconds;
  }, 0);

  return Math.round(totalSeconds / scores.length);
}

export function sortRankingRows(rows: Omit<RankingRowInput, "position">[]) {
  return rows
    .slice()
    .sort((a, b) => {
      const pointsA = a.points ?? 0;
      const pointsB = b.points ?? 0;
      const exactScoresA = a.exactScores ?? 0;
      const exactScoresB = b.exactScores ?? 0;
      const winsA = a.wins ?? 0;
      const winsB = b.wins ?? 0;
      const hitsA = a.hits ?? 0;
      const hitsB = b.hits ?? 0;
      const currentStreakA = a.currentStreak ?? 0;
      const currentStreakB = b.currentStreak ?? 0;

      if (pointsB !== pointsA) {
        return pointsB - pointsA;
      }

      if (exactScoresB !== exactScoresA) {
        return exactScoresB - exactScoresA;
      }

      if (winsB !== winsA) {
        return winsB - winsA;
      }

      if (hitsB !== hitsA) {
        return hitsB - hitsA;
      }

      if (currentStreakB !== currentStreakA) {
        return currentStreakB - currentStreakA;
      }

      const averageA = a.averageSubmitSeconds ?? Number.MAX_SAFE_INTEGER;
      const averageB = b.averageSubmitSeconds ?? Number.MAX_SAFE_INTEGER;

      if (averageA !== averageB) {
        return averageA - averageB;
      }

      return a.userId.localeCompare(b.userId);
    })
    .map((row, index) => ({
      ...row,
      position: index + 1
    }));
}

export function buildRankingRows(
  scores: ScoreRecord[],
  context: RankingContext
): RankingRowInput[] {
  const scoresByUser = scores.reduce<Map<string, ScoreRecord[]>>((accumulator, score) => {
    const userScores = accumulator.get(score.userId) ?? [];
    userScores.push(score);
    accumulator.set(score.userId, userScores);

    return accumulator;
  }, new Map<string, ScoreRecord[]>());

  const rows = Array.from(scoresByUser.entries()).map(([userId, userScores]) => {
    const hits = userScores.filter((score) => score.winnerHit).length;

    return {
      averageSubmitSeconds: getAverageSubmitSeconds(userScores),
      currentStreak: getCurrentStreak(userScores),
      exactScores: userScores.filter((score) => score.exactScore).length,
      hits,
      leagueId: context.leagueId ?? null,
      losses: Math.max(0, userScores.length - hits),
      points: userScores.reduce((sum, score) => sum + score.totalPoints, 0),
      roundId: context.roundId ?? null,
      scope: context.scope,
      seasonId: context.seasonId ?? null,
      userId,
      wins: hits
    };
  });

  return sortRankingRows(rows);
}

export function applyRankingAdjustments(
  rows: RankingRowInput[],
  adjustments: RankingAdjustmentInput[],
  context: RankingContext
): RankingRowInput[] {
  if (adjustments.length === 0) {
    return rows;
  }

  const rowsByUser = rows.reduce<Map<string, Omit<RankingRowInput, "position">>>(
    (accumulator, row) => {
      const rowWithoutPosition = {
        averageSubmitSeconds: row.averageSubmitSeconds,
        currentStreak: row.currentStreak,
        exactScores: row.exactScores,
        hits: row.hits,
        leagueId: row.leagueId,
        losses: row.losses,
        points: row.points,
        roundId: row.roundId,
        scope: row.scope,
        seasonId: row.seasonId,
        userId: row.userId,
        wins: row.wins
      };

      accumulator.set(row.userId, rowWithoutPosition);

      return accumulator;
    },
    new Map<string, Omit<RankingRowInput, "position">>()
  );
  const adjustmentTotals = adjustments.reduce<Map<string, number>>((accumulator, adjustment) => {
    accumulator.set(
      adjustment.userId,
      (accumulator.get(adjustment.userId) ?? 0) + adjustment.pointsDelta
    );

    return accumulator;
  }, new Map<string, number>());

  for (const [userId, pointsDelta] of adjustmentTotals.entries()) {
    const existingRow = rowsByUser.get(userId);

    if (existingRow) {
      rowsByUser.set(userId, {
        ...existingRow,
        points: (existingRow.points ?? 0) + pointsDelta
      });
      continue;
    }

    rowsByUser.set(userId, {
      averageSubmitSeconds: null,
      currentStreak: 0,
      exactScores: 0,
      hits: 0,
      leagueId: context.leagueId ?? null,
      losses: 0,
      points: pointsDelta,
      roundId: context.roundId ?? null,
      scope: context.scope,
      seasonId: context.seasonId ?? null,
      userId,
      wins: 0
    });
  }

  return sortRankingRows(Array.from(rowsByUser.values()));
}

async function replaceRankingRows(
  where: Prisma.RankingWhereInput,
  rows: RankingRowInput[]
): Promise<number> {
  await prisma.$transaction(async (tx) => {
    await tx.ranking.deleteMany({
      where
    });

    if (rows.length > 0) {
      await tx.ranking.createMany({
        data: rows
      });
    }
  });

  return rows.length;
}

async function getScores(where: Prisma.ScoreWhereInput = {}) {
  return prisma.score.findMany({
    orderBy: {
      calculatedAt: "desc"
    },
    select: scoreSelect,
    where: {
      match: {
        homologatedAt: {
          not: null
        }
      },
      ...where
    }
  });
}

export async function recalculateGlobalRankings() {
  const scores = await getScores();
  const rows = buildRankingRows(scores, {
    scope: "GLOBAL"
  });

  return replaceRankingRows(
    {
      scope: "GLOBAL"
    },
    rows
  );
}

export async function recalculateHistoricalRankings() {
  const scores = await getScores();
  const rows = buildRankingRows(scores, {
    scope: "HISTORICAL"
  });

  return replaceRankingRows(
    {
      scope: "HISTORICAL"
    },
    rows
  );
}

export async function recalculateMonthlyRankings(referenceDate = new Date()) {
  const { end, start } = getMonthRange(referenceDate);
  const scores = await getScores({
    match: {
      kickoff: {
        gte: start,
        lt: end
      }
    }
  });
  const rows = buildRankingRows(scores, {
    scope: "MONTHLY"
  });

  return replaceRankingRows(
    {
      scope: "MONTHLY"
    },
    rows
  );
}

export async function recalculateRoundRanking(roundId: string) {
  const scores = await getScores({
    match: {
      roundId
    }
  });
  const rows = buildRankingRows(scores, {
    roundId,
    scope: "ROUND"
  });

  return replaceRankingRows(
    {
      roundId,
      scope: "ROUND"
    },
    rows
  );
}

export async function recalculateSeasonRanking(seasonId: string) {
  const scores = await getScores({
    match: {
      round: {
        seasonId
      }
    }
  });
  const rows = buildRankingRows(scores, {
    scope: "GLOBAL",
    seasonId
  });

  return replaceRankingRows(
    {
      scope: "GLOBAL",
      seasonId
    },
    rows
  );
}

export async function recalculateLeagueRankings() {
  const leagues = await prisma.league.findMany({
    select: {
      id: true
    },
    where: {
      deletedAt: null
    }
  });

  let createdRows = 0;

  for (const league of leagues) {
    createdRows += await recalculateLeagueRanking(league.id);
  }

  return createdRows;
}

export async function recalculateLeagueRanking(leagueId: string) {
  const league = await prisma.league.findFirst({
    select: {
      id: true,
      members: {
        select: {
          userId: true
        },
        where: {
          status: "ACTIVE"
        }
      }
    },
    where: {
      deletedAt: null,
      id: leagueId
    }
  });

  if (!league) {
    throw new Error("LEAGUE_NOT_FOUND");
  }

  const userIds = league.members.map((member) => member.userId);
  const scores =
    userIds.length > 0
      ? await getScores({
          leagueId: league.id,
          userId: {
            in: userIds
          }
        })
      : [];
  const rows = buildRankingRows(scores, {
    leagueId: league.id,
    scope: "LEAGUE"
  });
  const adjustments =
    userIds.length > 0
      ? await prisma.rankingAdjustment.findMany({
          select: {
            pointsDelta: true,
            userId: true
          },
          where: {
            leagueId: league.id,
            userId: {
              in: userIds
            }
          }
        })
      : [];
  const adjustedRows = applyRankingAdjustments(rows, adjustments, {
    leagueId: league.id,
    scope: "LEAGUE"
  });

  return replaceRankingRows(
    {
      leagueId: league.id,
      scope: "LEAGUE"
    },
    adjustedRows
  );
}

export async function recalculateRankingsForMatch(
  matchId: string
): Promise<RankingRecalculationSummary> {
  const match = await prisma.match.findUnique({
    select: {
      kickoff: true,
      round: {
        select: {
          id: true,
          leagueId: true,
          seasonId: true
        }
      }
    },
    where: {
      id: matchId
    }
  });

  if (!match) {
    throw new Error("MATCH_NOT_FOUND");
  }

  const scoreLeagueIds = await prisma.score.findMany({
    distinct: ["leagueId"],
    select: {
      leagueId: true
    },
    where: {
      leagueId: {
        not: null
      },
      matchId
    }
  });
  const affectedLeagueIds = Array.from(
    new Set(
      [match.round.leagueId, ...scoreLeagueIds.map((score) => score.leagueId)].filter(
        (leagueId): leagueId is string => Boolean(leagueId)
      )
    )
  );

  const [globalRows, historicalRows, monthlyRows, roundRows, seasonRows, leagueRows] =
    await Promise.all([
      recalculateGlobalRankings(),
      recalculateHistoricalRankings(),
      recalculateMonthlyRankings(match.kickoff),
      recalculateRoundRanking(match.round.id),
      recalculateSeasonRanking(match.round.seasonId),
      Promise.all(affectedLeagueIds.map((leagueId) => recalculateLeagueRanking(leagueId))).then(
        (rows) => rows.reduce((sum, rowCount) => sum + rowCount, 0)
      )
    ]);

  return {
    globalRows,
    historicalRows,
    leagueRows,
    monthlyRows,
    roundRows,
    seasonRows
  };
}
