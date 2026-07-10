export type FootballCompetitionKey =
  | "brasileirao-serie-a"
  | "libertadores"
  | "sul-americana"
  | "champions-league"
  | "copa-do-brasil";

export type FootballCompetitionType = "LEAGUE" | "CUP";

export type FootballCompetitionConfig = {
  countryOrContinent: string;
  key: FootballCompetitionKey;
  leagueId: number;
  name: string;
  season: number;
  type: FootballCompetitionType;
};

// IDs confirmados via API-Football /leagues em 2026-07-10.
export const footballCompetitionConfigs: FootballCompetitionConfig[] = [
  {
    countryOrContinent: "Brasil",
    key: "brasileirao-serie-a",
    leagueId: 71,
    name: "Brasileirao Serie A",
    season: 2026,
    type: "LEAGUE"
  },
  {
    countryOrContinent: "CONMEBOL",
    key: "libertadores",
    leagueId: 13,
    name: "CONMEBOL Libertadores",
    season: 2026,
    type: "CUP"
  },
  {
    countryOrContinent: "CONMEBOL",
    key: "sul-americana",
    leagueId: 11,
    name: "CONMEBOL Sudamericana",
    season: 2026,
    type: "CUP"
  },
  {
    countryOrContinent: "Europa",
    key: "champions-league",
    leagueId: 2,
    name: "UEFA Champions League",
    season: 2026,
    type: "CUP"
  },
  {
    countryOrContinent: "Brasil",
    key: "copa-do-brasil",
    leagueId: 73,
    name: "Copa Do Brasil",
    season: 2026,
    type: "CUP"
  }
];

export function getFootballCompetitionConfig(key: string) {
  return footballCompetitionConfigs.find((competition) => competition.key === key) ?? null;
}

export function getFootballSyncCacheHours() {
  const configuredHours = Number(process.env.FOOTBALL_SYNC_CACHE_HOURS ?? "12");

  return Number.isFinite(configuredHours) && configuredHours >= 0 ? configuredHours : 12;
}
