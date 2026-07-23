import { describe, expect, it } from "vitest";

import { calculateGuessScore, getOfficialPrediction } from "./scoring-service";
import type { ScoringDefaults } from "../data/scoring-settings";

const scoring: ScoringDefaults = {
  exactScoreBonus: 3,
  jokerLimitPerRound: 1,
  jokerMultiplier: 2,
  winnerHit: 3
};

describe("scoring service", () => {
  it("detects the official 1X2 result", () => {
    expect(getOfficialPrediction(2, 1)).toBe("HOME");
    expect(getOfficialPrediction(1, 1)).toBe("DRAW");
    expect(getOfficialPrediction(0, 3)).toBe("AWAY");
  });

  it("awards winner points plus exact score bonus", () => {
    const score = calculateGuessScore(
      {
        awayPrediction: 1,
        homePrediction: 2,
        joker: false,
        prediction: "HOME"
      },
      {
        awayScore: 1,
        homeScore: 2
      },
      scoring
    );

    expect(score).toEqual({
      basePoints: 3,
      bonusPoints: 3,
      exactScore: true,
      jokerApplied: false,
      totalPoints: 6,
      winnerHit: true
    });
  });

  it("multiplies the full subtotal when joker is applied", () => {
    const score = calculateGuessScore(
      {
        awayPrediction: 0,
        homePrediction: 1,
        joker: true,
        prediction: "HOME"
      },
      {
        awayScore: 2,
        homeScore: 3
      },
      scoring
    );

    expect(score.basePoints).toBe(3);
    expect(score.bonusPoints).toBe(0);
    expect(score.totalPoints).toBe(6);
    expect(score.jokerApplied).toBe(true);
  });

  it("awards winner points when 0 x 1 predicts the same winner as a 1 x 2 result", () => {
    const score = calculateGuessScore(
      {
        awayPrediction: 1,
        homePrediction: 0,
        joker: false,
        prediction: "AWAY"
      },
      {
        awayScore: 2,
        homeScore: 1
      },
      scoring
    );

    expect(score.basePoints).toBe(3);
    expect(score.bonusPoints).toBe(0);
    expect(score.totalPoints).toBe(3);
    expect(score.winnerHit).toBe(true);
    expect(score.exactScore).toBe(false);
  });

  it("uses the numeric guess score when a legacy prediction field is inconsistent", () => {
    const score = calculateGuessScore(
      {
        awayPrediction: 1,
        homePrediction: 0,
        joker: false,
        prediction: "HOME"
      },
      {
        awayScore: 2,
        homeScore: 1
      },
      scoring
    );

    expect(score.totalPoints).toBe(3);
    expect(score.winnerHit).toBe(true);
  });

  it("returns zero points for a wrong winner and wrong score", () => {
    const score = calculateGuessScore(
      {
        awayPrediction: 1,
        homePrediction: 2,
        joker: true,
        prediction: "HOME"
      },
      {
        awayScore: 2,
        homeScore: 0
      },
      scoring
    );

    expect(score.totalPoints).toBe(0);
    expect(score.winnerHit).toBe(false);
    expect(score.exactScore).toBe(false);
  });
});
