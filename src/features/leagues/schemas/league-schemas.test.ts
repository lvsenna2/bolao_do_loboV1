import { describe, expect, it } from "vitest";

import { createLeagueSchema } from "./league-schemas";

const championshipId = "11111111-1111-4111-8111-111111111111";

describe("league schemas", () => {
  it("interprets league datetime-local fields as Sao Paulo time", () => {
    const parsed = createLeagueSchema.parse({
      championshipId,
      endsAt: "2026-07-12T20:00",
      entryFee: "0",
      name: "Liga Brasileira",
      startsAt: "2026-07-12T18:00",
      visibility: "PUBLIC"
    });

    expect(parsed.startsAt?.toISOString()).toBe("2026-07-12T21:00:00.000Z");
    expect(parsed.endsAt?.toISOString()).toBe("2026-07-12T23:00:00.000Z");
  });
});
