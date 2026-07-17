import { afterEach, describe, expect, it } from "vitest";

import {
  footballCompetitionConfigs,
  getFootballCompetitionConfig,
  getFootballManualSyncCooldownHours
} from "./competitions";

afterEach(() => {
  delete process.env.FOOTBALL_MANUAL_SYNC_COOLDOWN_HOURS;
});

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

  it("usa intervalo manual de 12 horas por padrao", () => {
    expect(getFootballManualSyncCooldownHours()).toBe(12);
  });

  it("resolve somente campeonatos permitidos na sincronizacao manual", () => {
    expect(getFootballCompetitionConfig("libertadores")?.leagueId).toBe(13);
    expect(getFootballCompetitionConfig("campeonato-invalido")).toBeNull();
  });

  it("limita o intervalo manual configuravel entre 1 e 72 horas", () => {
    process.env.FOOTBALL_MANUAL_SYNC_COOLDOWN_HOURS = "24";
    expect(getFootballManualSyncCooldownHours()).toBe(24);

    process.env.FOOTBALL_MANUAL_SYNC_COOLDOWN_HOURS = "100";
    expect(getFootballManualSyncCooldownHours()).toBe(72);
  });
});
