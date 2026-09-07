import { describe, expect, it } from "vitest";

import { getPredictionFromScore, upsertGuessSchema } from "./guess-schemas";

describe("guess schemas", () => {
  const validGuess = {
    awayPrediction: 0,
    homePrediction: 0,
    matchId: "11111111-1111-4111-8111-111111111111",
    prediction: "DRAW"
  };

  it.each(["", "   ", null, undefined, false, true, [], [0]].map((value) => [value]))(
    "rejects missing or non-score input %j on either team",
    (value) => {
      for (const field of ["homePrediction", "awayPrediction"] as const) {
        const parsed = upsertGuessSchema.safeParse({ ...validGuess, [field]: value });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error.flatten().fieldErrors[field]).toBeDefined();
        }
      }
    }
  );

  it.each([false, "false", undefined])("keeps joker disabled for %j", (joker) => {
    const parsed = upsertGuessSchema.parse({ ...validGuess, joker });
    expect(parsed.joker).toBe(false);
  });

  it.each([true, "true"])("enables joker for %j", (joker) => {
    expect(upsertGuessSchema.parse({ ...validGuess, joker }).joker).toBe(true);
  });

  it.each(["yes", "0", 1, null])("rejects ambiguous joker input %j", (joker) => {
    expect(upsertGuessSchema.safeParse({ ...validGuess, joker }).success).toBe(false);
  });

  it("accepts an explicit zero score", () => {
    expect(upsertGuessSchema.parse(validGuess).homePrediction).toBe(0);
    expect(upsertGuessSchema.parse({ ...validGuess, homePrediction: "0" }).homePrediction).toBe(0);
  });

  it("derives 1X2 prediction from the score", () => {
    expect(getPredictionFromScore(2, 1)).toBe("HOME");
    expect(getPredictionFromScore(1, 1)).toBe("DRAW");
    expect(getPredictionFromScore(0, 2)).toBe("AWAY");
  });

  it("accepts a valid guess and coerces form values", () => {
    const parsed = upsertGuessSchema.safeParse({
      awayPrediction: "1",
      homePrediction: "2",
      joker: "true",
      matchId: "11111111-1111-4111-8111-111111111111",
      prediction: "HOME"
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data.homePrediction : null).toBe(2);
    expect(parsed.success ? parsed.data.joker : null).toBe(true);
  });

  it("rejects a winner that does not match the informed score", () => {
    const parsed = upsertGuessSchema.safeParse({
      awayPrediction: 3,
      homePrediction: 1,
      joker: false,
      matchId: "11111111-1111-4111-8111-111111111111",
      prediction: "HOME"
    });

    expect(parsed.success).toBe(false);
    expect(parsed.success ? "" : parsed.error.flatten().fieldErrors.prediction?.[0]).toContain(
      "vencedor"
    );
  });

  it("rejects negative score values", () => {
    const parsed = upsertGuessSchema.safeParse({
      awayPrediction: 1,
      homePrediction: -1,
      joker: false,
      matchId: "11111111-1111-4111-8111-111111111111",
      prediction: "AWAY"
    });

    expect(parsed.success).toBe(false);
  });
});
