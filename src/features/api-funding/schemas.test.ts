import { describe, expect, it } from "vitest";

import { apiFundingContributionSchema } from "./schemas";

describe("apiFundingContributionSchema", () => {
  it.each([10, 15, 20])("accepts the supported amount %s", (amount) => {
    expect(
      apiFundingContributionSchema.safeParse({
        amount,
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440000"
      }).success
    ).toBe(true);
  });

  it("rejects an amount outside the supported options", () => {
    expect(
      apiFundingContributionSchema.safeParse({
        amount: 50,
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440000"
      }).success
    ).toBe(false);
  });
});
