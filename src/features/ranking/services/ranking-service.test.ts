import { describe, expect, it } from "vitest";

import {
  applyRankingAdjustments,
  buildRankingRows,
  getAverageSubmitSeconds,
  getMonthRange
} from "./ranking-service";

function scoreRecord({
  exactScore = false,
  kickoff,
  submittedAt,
  totalPoints,
  userId,
  winnerHit
}: {
  exactScore?: boolean;
  kickoff: Date;
  submittedAt: Date;
  totalPoints: number;
  userId: string;
  winnerHit: boolean;
}) {
  return {
    exactScore,
    guess: {
      submittedAt
    },
    leagueId: "league-1",
    match: {
      kickoff,
      round: {
        seasonId: "season-1"
      },
      roundId: "round-1"
    },
    totalPoints,
    userId,
    winnerHit
  };
}

describe("ranking service helpers", () => {
  it("calculates a calendar month range", () => {
    const { end, start } = getMonthRange(new Date("2026-06-30T15:00:00.000Z"));

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(5);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(6);
    expect(end.getDate()).toBe(1);
    expect(end.getHours()).toBe(0);
  });

  it("calculates average submit time before kickoff in seconds", () => {
    const kickoff = new Date("2026-06-30T18:00:00.000Z");
    const scores = [
      scoreRecord({
        kickoff,
        submittedAt: new Date("2026-06-30T17:00:00.000Z"),
        totalPoints: 3,
        userId: "user-a",
        winnerHit: true
      }),
      scoreRecord({
        kickoff,
        submittedAt: new Date("2026-06-30T17:30:00.000Z"),
        totalPoints: 0,
        userId: "user-a",
        winnerHit: false
      })
    ];

    expect(getAverageSubmitSeconds(scores)).toBe(2700);
  });

  it("orders users by points, exact scores and submit speed", () => {
    const kickoff = new Date("2026-06-30T18:00:00.000Z");
    const rows = buildRankingRows(
      [
        scoreRecord({
          exactScore: true,
          kickoff,
          submittedAt: new Date("2026-06-30T17:50:00.000Z"),
          totalPoints: 6,
          userId: "user-b",
          winnerHit: true
        }),
        scoreRecord({
          exactScore: true,
          kickoff,
          submittedAt: new Date("2026-06-30T17:40:00.000Z"),
          totalPoints: 6,
          userId: "user-a",
          winnerHit: true
        }),
        scoreRecord({
          exactScore: false,
          kickoff,
          submittedAt: new Date("2026-06-30T17:00:00.000Z"),
          totalPoints: 3,
          userId: "user-c",
          winnerHit: true
        })
      ],
      {
        scope: "GLOBAL"
      }
    );

    expect(rows.map((row) => [row.userId, row.position])).toEqual([
      ["user-b", 1],
      ["user-a", 2],
      ["user-c", 3]
    ]);
    expect(rows[0]).toMatchObject({
      exactScores: 1,
      hits: 1,
      losses: 0,
      points: 6,
      wins: 1
    });
  });

  it("applies manual league ranking adjustments", () => {
    const kickoff = new Date("2026-06-30T18:00:00.000Z");
    const rows = buildRankingRows(
      [
        scoreRecord({
          kickoff,
          submittedAt: new Date("2026-06-30T17:40:00.000Z"),
          totalPoints: 10,
          userId: "user-a",
          winnerHit: true
        }),
        scoreRecord({
          kickoff,
          submittedAt: new Date("2026-06-30T17:50:00.000Z"),
          totalPoints: 8,
          userId: "user-b",
          winnerHit: true
        })
      ],
      {
        leagueId: "league-1",
        scope: "LEAGUE"
      }
    );

    const adjustedRows = applyRankingAdjustments(
      rows,
      [
        {
          pointsDelta: -5,
          userId: "user-a"
        },
        {
          pointsDelta: 3,
          userId: "user-c"
        }
      ],
      {
        leagueId: "league-1",
        scope: "LEAGUE"
      }
    );

    expect(adjustedRows.map((row) => [row.userId, row.points, row.position])).toEqual([
      ["user-b", 8, 1],
      ["user-a", 5, 2],
      ["user-c", 3, 3]
    ]);
  });
});
