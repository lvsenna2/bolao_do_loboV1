import { describe, expect, it } from "vitest";

import { evaluateSpecialRoundAnswer, rankSpecialRoundEntries } from "./scoring-service";

describe("special round scoring", () => {
  it("scores exact result independently", () => {
    expect(
      evaluateSpecialRoundAnswer(
        { kind: "EXACT_SCORE", points: 6 },
        { home: 2, away: 1 },
        { home: 2, away: 1 }
      )
    ).toMatchObject({ exactScoreHit: true, hit: true, points: 6 });
  });

  it("scores over and under using the configured line", () => {
    expect(
      evaluateSpecialRoundAnswer({ kind: "TOTAL_GOALS", line: 2.5, points: 2 }, "OVER", 3).points
    ).toBe(2);
  });

  it.each([
    ["MATCH_RESULT", "HOME", "HOME"],
    ["BOTH_TEAMS_SCORE", true, true],
    ["FIRST_TEAM_TO_SCORE", "AWAY", "AWAY"],
    ["GOAL_SCORER", "PLAYER_10", "PLAYER_10"],
    ["CUSTOM", "OPTION_A", "OPTION_A"]
  ] as const)("scores equality market %s", (kind, prediction, official) => {
    expect(evaluateSpecialRoundAnswer({ kind, points: 3 }, prediction, official).points).toBe(3);
  });

  it.each(["TOTAL_CORNERS", "TOTAL_CARDS"] as const)("scores line market %s", (kind) => {
    expect(evaluateSpecialRoundAnswer({ kind, line: 9.5, points: 2 }, "UNDER", 8).points).toBe(2);
  });

  it("uses submission time after score and hit tiebreakers", () => {
    const ranked = rankSpecialRoundEntries([
      {
        entryId: "late",
        exactScoreHits: 0,
        firstSubmittedAt: new Date("2026-07-26T20:01:00Z"),
        hits: 2,
        manualTieBreak: 0,
        maxPointsHits: 2,
        totalPoints: 5
      },
      {
        entryId: "early",
        exactScoreHits: 0,
        firstSubmittedAt: new Date("2026-07-26T20:00:00Z"),
        hits: 2,
        manualTieBreak: 0,
        maxPointsHits: 2,
        totalPoints: 5
      }
    ]);

    expect(ranked[0].entryId).toBe("early");
  });
});
