import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(async (queries: Promise<unknown>[]) => Promise.all(queries)),
    league: {
      findMany: vi.fn()
    },
    round: {
      count: vi.fn(),
      findMany: vi.fn()
    },
    season: {
      findMany: vi.fn()
    },
    team: {
      findMany: vi.fn()
    }
  }
}));

vi.mock("@/server/db", () => ({
  prisma: prismaMock
}));

import { getAdminRounds } from "./admin-data";

describe("getAdminRounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.round.findMany.mockResolvedValue([]);
    prismaMock.round.count.mockResolvedValue(0);
    prismaMock.season.findMany.mockResolvedValue([]);
    prismaMock.team.findMany.mockResolvedValue([]);
    prismaMock.league.findMany.mockResolvedValue([]);
  });

  it("carrega todas as partidas ativas da rodada sem limite artificial", async () => {
    await getAdminRounds({});

    const roundsQuery = prismaMock.round.findMany.mock.calls[0]?.[0];

    expect(roundsQuery.include.matches.take).toBeUndefined();
    expect(roundsQuery.include.matches.where).toEqual({ deletedAt: null });
    expect(roundsQuery.include._count.select.matches).toEqual({
      where: { deletedAt: null }
    });
  });
});
