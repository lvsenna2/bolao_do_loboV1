import { describe, expect, it } from "vitest";

import { calculateSubscriptionDiscount, subscriptionHasBenefits } from "./service";

describe("subscription benefits", () => {
  const now = new Date("2026-08-05T12:00:00.000Z");

  it("keeps canceled benefits until the paid period ends", () => {
    expect(
      subscriptionHasBenefits(
        { currentPeriodEnd: new Date("2026-09-05T12:00:00.000Z"), status: "CANCELED" },
        now
      )
    ).toBe(true);
  });

  it("expires benefits at the end of the paid period", () => {
    expect(
      subscriptionHasBenefits(
        { currentPeriodEnd: new Date("2026-08-05T11:59:59.000Z"), status: "ACTIVE" },
        now
      )
    ).toBe(false);
  });

  it("suspends benefits for past due subscriptions", () => {
    expect(
      subscriptionHasBenefits(
        { currentPeriodEnd: new Date("2026-09-05T12:00:00.000Z"), status: "PAST_DUE" },
        now
      )
    ).toBe(false);
  });

  it("applies plan discounts without trusting a client amount", () => {
    expect(calculateSubscriptionDiscount(100, { discountPercent: 50, freeLeagues: false })).toEqual(
      {
        discountAmount: 50,
        discountPercent: 50,
        finalAmount: 50,
        originalAmount: 100
      }
    );
    expect(
      calculateSubscriptionDiscount(100, { discountPercent: 0, freeLeagues: true }).finalAmount
    ).toBe(0);
  });
});
