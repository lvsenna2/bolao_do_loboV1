import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    round: {
      findMany: vi.fn()
    }
  }
}));

vi.mock("@/server/db", () => ({
  prisma: prismaMock
}));

import { getPendingGuessRounds } from "./guess-data";

describe("pending guess rounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista somente rodadas com partidas ainda sem palpite completo", async () => {
    prismaMock.round.findMany.mockResolvedValue([
      {
        endsAt: new Date("2026-09-03T00:00:00.000Z"),
        id: "round-1",
        league: { championshipId: "champ-1", id: "league-1", name: "Liga Principal" },
        matches: [
          {
            guesses: [{ awayPrediction: 1, homePrediction: 2, leagueId: "league-1" }],
            id: "match-complete"
          },
          { guesses: [], id: "match-empty" },
          {
            guesses: [{ awayPrediction: null, homePrediction: 1, leagueId: "league-1" }],
            id: "match-partial"
          }
        ],
        name: null,
        number: 3,
        season: { championshipId: "champ-1", name: "2026", year: 2026 }
      },
      {
        endsAt: new Date("2026-09-04T00:00:00.000Z"),
        id: "round-invalid",
        league: { championshipId: "champ-2", id: "league-2", name: "Liga Invalida" },
        matches: [{ guesses: [], id: "match-invalid" }],
        name: "Rodada invalida",
        number: 4,
        season: { championshipId: "champ-1", name: "2026", year: 2026 }
      }
    ]);

    await expect(getPendingGuessRounds("user-1")).resolves.toEqual([
      {
        endsAt: "2026-09-03T00:00:00.000Z",
        id: "round-1",
        label: "Rodada 3 - 2026",
        leagueName: "Liga Principal",
        pendingMatches: 2
      }
    ]);
  });
});
