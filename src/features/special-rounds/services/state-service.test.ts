import { describe, expect, it } from "vitest";

import { canTransitionSpecialRound, isPredictionWindowOpen } from "./state-service";

describe("special round state", () => {
  it("allows the expected lifecycle and blocks shortcuts", () => {
    expect(canTransitionSpecialRound("DRAFT", "REGISTRATION_OPEN")).toBe(true);
    expect(canTransitionSpecialRound("DRAFT", "FINALIZED")).toBe(false);
  });

  it("blocks predictions at the server deadline", () => {
    const closesAt = new Date("2026-07-26T20:00:00Z");
    expect(
      isPredictionWindowOpen({
        closesAt,
        matchStartsAt: new Date("2026-07-26T21:00:00Z"),
        now: closesAt,
        opensAt: new Date("2026-07-26T10:00:00Z"),
        status: "PREDICTIONS_OPEN"
      })
    ).toBe(false);
  });
});
