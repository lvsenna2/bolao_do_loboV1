import { describe, expect, it } from "vitest";

import { getPlanConfig } from "./config";
import { startSubscriptionSchema } from "./schemas";

describe("subscription plans", () => {
  it("keeps prices and benefits in the server configuration", () => {
    expect(getPlanConfig("PRATA")).toMatchObject({
      benefits: { discountPercent: 25 },
      price: 4.99
    });
    expect(getPlanConfig("OURO")).toMatchObject({
      benefits: { discountPercent: 50 },
      price: 9.99
    });
    expect(getPlanConfig("PLATINUM")).toMatchObject({
      benefits: { canCreateSpecialRound: true, freeLeagues: true },
      price: 19.99
    });
  });

  it("rejects prices supplied by the client", () => {
    expect(
      startSubscriptionSchema.safeParse({
        amount: 0.01,
        idempotencyKey: "b44df0a8-5a75-4af1-958b-d9ea04760c59",
        paymentMethod: "CARD",
        plan: "PLATINUM"
      }).success
    ).toBe(false);
  });
});
