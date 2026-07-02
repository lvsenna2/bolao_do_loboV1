import { describe, expect, it } from "vitest";

import { getPredictionFromScore, upsertGuessSchema } from "./guess-schemas";

describe("guess schemas", () => {
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
