import { describe, expect, it } from "vitest";

import { addBillingMonth } from "./payment-service";

describe("subscription billing period", () => {
  it("adds one calendar month", () => {
    expect(addBillingMonth(new Date("2026-08-05T15:00:00.000Z")).toISOString()).toBe(
      "2026-09-05T15:00:00.000Z"
    );
  });

  it("clamps dates at the end of shorter months", () => {
    expect(addBillingMonth(new Date("2027-01-31T15:00:00.000Z")).toISOString()).toBe(
      "2027-02-28T15:00:00.000Z"
    );
  });
});
