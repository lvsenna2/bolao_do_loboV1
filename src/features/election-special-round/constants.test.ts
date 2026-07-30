import { describe, expect, it } from "vitest";

import { getMarginRange, getWinnerRange } from "./constants";

describe("election range calculation", () => {
  it("maps winner percentage boundaries", () => {
    expect(getWinnerRange(29.99)).toBe("UNDER_30");
    expect(getWinnerRange(30)).toBe("30_34_99");
    expect(getWinnerRange(51.99)).toBe("50_51_99");
    expect(getWinnerRange(60)).toBe("60_PLUS");
  });

  it("maps margin percentage boundaries", () => {
    expect(getMarginRange(1.99)).toBe("UNDER_2");
    expect(getMarginRange(2)).toBe("2_3_99");
    expect(getMarginRange(9.99)).toBe("8_9_99");
    expect(getMarginRange(10)).toBe("10_PLUS");
  });
});
