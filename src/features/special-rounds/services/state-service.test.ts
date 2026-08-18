import { describe, expect, it } from "vitest";

import {
  activeSpecialRoundOfFormatWhere,
  blockingSpecialRoundStatuses,
  canDeleteSpecialRoundEntries,
  canTransitionSpecialRound,
  isPredictionWindowOpen
} from "./state-service";

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

  it("does not treat finalized or cancelled rounds as active duplicates", () => {
    expect(blockingSpecialRoundStatuses).not.toContain("FINALIZED");
    expect(blockingSpecialRoundStatuses).not.toContain("CANCELLED");
  });

  it("scopes active duplicates by round format", () => {
    expect(activeSpecialRoundOfFormatWhere("match-1", "STANDARD")).toEqual({
      format: "STANDARD",
      matchId: "match-1",
      status: { in: blockingSpecialRoundStatuses }
    });
    expect(activeSpecialRoundOfFormatWhere("match-1", "PROMO_SINGLE_SELECTION")).toEqual({
      format: "PROMO_SINGLE_SELECTION",
      matchId: "match-1",
      status: { in: blockingSpecialRoundStatuses }
    });
  });

  it("only deletes entries without real payment transactions", () => {
    expect(canDeleteSpecialRoundEntries([{ paymentStatus: "PENDING", transactionId: null }])).toBe(
      true
    );
    expect(
      canDeleteSpecialRoundEntries([{ paymentStatus: "APPROVED", transactionId: "payment-1" }])
    ).toBe(false);
    expect(
      canDeleteSpecialRoundEntries([{ paymentStatus: "PENDING", transactionId: "payment-2" }])
    ).toBe(false);
  });

});
