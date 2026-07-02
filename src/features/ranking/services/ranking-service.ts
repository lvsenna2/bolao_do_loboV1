import { Prisma, type RankingScope } from "@prisma/client";

import { prisma } from "@/server/db";

type RankingContext = {
  leagueId?: string | null;
  roundId?: string | null;
  scope: RankingScope;
  seasonId?: string | null;
};

type RankingRowInput = Prisma.RankingCreateManyInput;

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
      deletedAt: null
    }
  });

  let createdRows = 0;

  await prisma.ranking.deleteMany({
    where: {
      scope: "LEAGUE"
    }
  });

  for (const league of leagues) {
    const userIds = league.members.map((member) => member.userId);

    if (userIds.length === 0) {
      continue;
    }

    const scores = await getScores({
      leagueId: league.id,
      userId: {
        in: userIds
      }
    });
    const rows = buildRankingRows(scores, {
      leagueId: league.id,
      scope: "LEAGUE"
    });

    if (rows.length > 0) {
      await prisma.ranking.createMany({
        data: rows
      });
      createdRows += rows.length;
    }
  }

  return createdRows;
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

  const [globalRows, historicalRows, monthlyRows, roundRows, seasonRows, leagueRows] =
    await Promise.all([
      recalculateGlobalRankings(),
      recalculateHistoricalRankings(),
      recalculateMonthlyRankings(match.kickoff),
      recalculateRoundRanking(match.round.id),
      recalculateSeasonRanking(match.round.seasonId),
      recalculateLeagueRankings()
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
