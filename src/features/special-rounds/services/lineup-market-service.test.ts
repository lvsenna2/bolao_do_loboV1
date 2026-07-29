import { describe, expect, it } from "vitest";

import { shouldReuseSpecialRoundLineup } from "./lineup-market-service";

describe("special round lineup refresh", () => {
  const now = new Date("2026-07-29T18:00:00.000Z");

  it("reuses a complete lineup synchronized less than five minutes ago", () => {
    expect(
      shouldReuseSpecialRoundLineup({
        complete: true,
        now,
        syncedAt: new Date("2026-07-29T17:56:00.000Z")
      })
    ).toBe(true);
  });

  it("refreshes stale or incomplete lineups", () => {
    expect(
      shouldReuseSpecialRoundLineup({
        complete: true,
        now,
        syncedAt: new Date("2026-07-29T17:55:00.000Z")
      })
    ).toBe(false);
    expect(
      shouldReuseSpecialRoundLineup({
        complete: false,
        now,
        syncedAt: new Date("2026-07-29T17:59:00.000Z")
      })
    ).toBe(false);
  });
});
