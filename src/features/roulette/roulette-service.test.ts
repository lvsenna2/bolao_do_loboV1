import { describe, expect, it } from "vitest";

import { DAILY_ROULETTE_PRIZES } from "./roulette-config";
import { pickRoulettePrize } from "./roulette-service";

describe("daily roulette", () => {
  it("keeps configured probability at 100%", () => {
    expect(DAILY_ROULETTE_PRIZES.reduce((sum, prize) => sum + prize.probabilityUnits, 0)).toBe(
      100_000
    );
  });

  it("selects jackpot only on final unit", () => {
    expect(pickRoulettePrize(DAILY_ROULETTE_PRIZES, 99_999).id).toBe("jackpot");
  });

  it("selects no prize in first half", () => {
    expect(pickRoulettePrize(DAILY_ROULETTE_PRIZES, 49_999).id).toBe("none");
  });
});
