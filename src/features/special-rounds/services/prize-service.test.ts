import { describe, expect, it } from "vitest";

import { calculateSpecialRoundPrizePool, distributeSpecialRoundPrize } from "./prize-service";

describe("special round prizes", () => {
  it("ignores pending entries by receiving confirmed amounts only", () => {
    const result = calculateSpecialRoundPrizePool({
      adminFeePercent: 10,
      confirmedAmounts: [10, 10],
      mode: "POOL",
      poolPercent: 90
    });
    expect(result).toEqual({ adminFee: 2, collected: 20, prize: 18 });
  });

  it("distributes the configured percentages", () => {
    expect(
      distributeSpecialRoundPrize(100, [
        { percent: 70, position: 1 },
        { percent: 30, position: 2 }
      ])
    ).toEqual([
      { amount: 70, percentage: 70, position: 1 },
      { amount: 30, percentage: 30, position: 2 }
    ]);
  });
});
