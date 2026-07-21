import { describe, expect, it } from "vitest";

import {
  createMatchSchema,
  createRoundSchema,
  grantLeagueBadgeSchema,
  importApiFootballTeamsSchema
} from "./admin-schemas";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("admin schemas", () => {
  it("interpreta datas de rodada do admin no horario de Sao Paulo", () => {
    const parsed = createRoundSchema.parse({
      endsAt: "2026-07-03T01:06",
      leagueId: uuid,
      number: "1",
      seasonId: uuid,
      startsAt: "2026-07-03T00:06",
      status: "OPEN"
    });

    expect(parsed.startsAt.toISOString()).toBe("2026-07-03T03:06:00.000Z");
    expect(parsed.endsAt.toISOString()).toBe("2026-07-03T04:06:00.000Z");
  });

  it("interpreta horario de partida do admin no horario de Sao Paulo", () => {
    const parsed = createMatchSchema.parse({
      awayTeamId: "33333333-3333-4333-8333-333333333333",
      homeTeamId: "22222222-2222-4222-8222-222222222222",
      kickoff: "2026-07-03T00:06",
      roundId: uuid,
      status: "SCHEDULED"
    });

    expect(parsed.kickoff.toISOString()).toBe("2026-07-03T03:06:00.000Z");
  });

  it("permite importar times da API por pais", () => {
    const parsed = importApiFootballTeamsSchema.parse({
      country: "Brazil"
    });

    expect(parsed.country).toBe("Brazil");
  });

  it("permite importar times da API por liga e temporada", () => {
    const parsed = importApiFootballTeamsSchema.parse({
      leagueId: "71",
      season: "2026"
    });

    expect(parsed.leagueId).toBe(71);
    expect(parsed.season).toBe(2026);
  });

  it("exige pais ou liga com temporada para a API", () => {
    const parsed = importApiFootballTeamsSchema.safeParse({
      country: "",
      leagueId: "",
      season: ""
    });

    expect(parsed.success).toBe(false);
  });

  it("valida a premiacao de um participante da liga", () => {
    const parsed = grantLeagueBadgeSchema.parse({
      badgeId: "22222222-2222-4222-8222-222222222222",
      category: "MOST_HITS",
      leagueId: uuid,
      reason: "Maior numero de resultados corretos.",
      userId: "33333333-3333-4333-8333-333333333333"
    });

    expect(parsed.category).toBe("MOST_HITS");
  });
});
