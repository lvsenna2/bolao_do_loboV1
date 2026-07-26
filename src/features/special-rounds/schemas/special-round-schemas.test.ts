import { describe, expect, it } from "vitest";

import { automaticSpecialRoundSchema } from "./special-round-schemas";

describe("automatic special round schema", () => {
  it("accepts a catalog match and converts the configured entry fee", () => {
    const result = automaticSpecialRoundSchema.parse({
      entryFee: "15.50",
      matchId: "d7f2dbf4-e26d-4d7a-bde4-74acd546a0c0"
    });

    expect(result.entryFee).toBe(15.5);
  });

  it("allows free rounds and rejects negative entry fees", () => {
    expect(
      automaticSpecialRoundSchema.safeParse({
        entryFee: 0,
        matchId: "d7f2dbf4-e26d-4d7a-bde4-74acd546a0c0"
      }).success
    ).toBe(true);
    expect(
      automaticSpecialRoundSchema.safeParse({
        entryFee: -1,
        matchId: "d7f2dbf4-e26d-4d7a-bde4-74acd546a0c0"
      }).success
    ).toBe(false);
  });
});
