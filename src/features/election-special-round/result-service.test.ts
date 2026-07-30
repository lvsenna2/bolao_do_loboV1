import { describe, expect, it } from "vitest";

import { isElectionWinningPrediction } from "./result-service";

const result = {
  marginRange: "2_3_99",
  runnerUpCandidateId: "candidate-2",
  turn: "SECOND" as const,
  winnerCandidateId: "candidate-1",
  winnerRange: "52_53_99"
};

describe("election winner criteria", () => {
  it("requires all five markets to match", () => {
    expect(isElectionWinningPrediction(result, result)).toBe(true);
    expect(isElectionWinningPrediction({ ...result, marginRange: "4_5_99" }, result)).toBe(false);
    expect(
      isElectionWinningPrediction({ ...result, runnerUpCandidateId: "candidate-3" }, result)
    ).toBe(false);
  });

  it("does not accept an absent prediction", () => {
    expect(isElectionWinningPrediction(null, result)).toBe(false);
  });
});
