import { describe, expect, it } from "vitest";

import { footballCompetitionConfigs } from "./competitions";

describe("footballCompetitionConfigs", () => {
  it("mantem os leagueIds confirmados na API-Football para 2026", () => {
    expect(
      footballCompetitionConfigs.map((competition) => ({
        key: competition.key,
        leagueId: competition.leagueId,
        season: competition.season
      }))
    ).toEqual([
      {
        key: "brasileirao-serie-a",
        leagueId: 71,
        season: 2026
      },
      {
        key: "libertadores",
        leagueId: 13,
        season: 2026
      },
      {
        key: "sul-americana",
        leagueId: 11,
        season: 2026
      },
      {
        key: "champions-league",
        leagueId: 2,
        season: 2026
      },
      {
        key: "copa-do-brasil",
        leagueId: 73,
        season: 2026
      }
    ]);
  });
});
