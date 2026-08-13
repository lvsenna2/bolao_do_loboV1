import { beforeEach, describe, expect, it, vi } from "vitest";

const { creditWalletMock, prismaMock, resolveMatchMock, txMock } = vi.hoisted(() => {
  const txMock = {
    notification: { createMany: vi.fn() },
    specialRound: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn()
    },
    specialRoundAuditLog: { create: vi.fn() },
    specialRoundEntry: { findMany: vi.fn() },
    specialRoundPrize: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(async (): Promise<unknown[]> => []),
      update: vi.fn()
    },
    specialRoundScore: { createMany: vi.fn(), deleteMany: vi.fn() },
    specialRoundStanding: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn()
    }
  };

  return {
    creditWalletMock: vi.fn(async () => ({})),
    resolveMatchMock: vi.fn(async (): Promise<{ id: string } | null> => null),
    prismaMock: {
      match: { findUnique: vi.fn() },
      $transaction: vi.fn(async (input: unknown) =>
        typeof input === "function"
          ? (input as (client: typeof txMock) => Promise<unknown>)(txMock)
          : Promise.all(input as Promise<unknown>[])
      ),
      specialRound: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(async () => ({}))
      },
      specialRoundAuditLog: { create: vi.fn(async () => ({})) },
      specialRoundResult: { upsert: vi.fn(async () => ({})) },
      specialRoundStanding: { findFirst: vi.fn() }
    },
    txMock
  };
});

vi.mock("@/server/db", () => ({ prisma: prismaMock }));
vi.mock("./match-link-service", () => ({
  resolveApiBackedSpecialRoundMatch: resolveMatchMock
}));
vi.mock("@/features/wallet/services/wallet-service", () => ({
  creditWalletInTransaction: creditWalletMock,
  formatCents: (value: number) => `R$ ${(value / 100).toFixed(2)}`
}));

import {
  isSpecialRoundMatchReadyForSettlement,
  settleFinishedSpecialRounds,
  settleableSpecialRoundStatuses
} from "./settlement-service";

const kickoff = new Date("2026-08-09T18:00:00Z");

function catalogRound() {
  return {
    id: "round-1",
    markets: [
      {
        answerType: "SINGLE_CHOICE",
        id: "market-1",
        kind: "MATCH_RESULT",
        options: [{ value: "HOME" }, { value: "DRAW" }, { value: "AWAY" }],
        title: "Resultado final"
      }
    ],
    match: {
      awayScore: 1,
      awayTeamId: "team-away",
      events: [],
      homeScore: 2,
      homeTeamId: "team-home",
      id: "match-1",
      statistics: [],
      status: "FINISHED"
    }
  };
}

describe("isSpecialRoundMatchReadyForSettlement", () => {
  it("aguarda a partida terminar", () => {
    expect(
      isSpecialRoundMatchReadyForSettlement({
        fullySyncedAt: null,
        kickoff,
        now: new Date(kickoff.getTime() + 30 * 60_000),
        status: "LIVE"
      })
    ).toBe(false);
  });

  it("libera assim que a partida encerrada esta consolidada", () => {
    expect(
      isSpecialRoundMatchReadyForSettlement({
        fullySyncedAt: new Date(kickoff.getTime() + 2 * 60 * 60_000),
        kickoff,
        now: new Date(kickoff.getTime() + 2 * 60 * 60_000),
        status: "FINISHED"
      })
    ).toBe(true);
  });

  it("espera a consolidacao antes do prazo de tolerancia", () => {
    expect(
      isSpecialRoundMatchReadyForSettlement({
        fullySyncedAt: null,
        kickoff,
        now: new Date(kickoff.getTime() + 2 * 60 * 60_000),
        status: "FINISHED"
      })
    ).toBe(false);
  });

  it("apura mesmo sem consolidacao depois do prazo de tolerancia", () => {
    expect(
      isSpecialRoundMatchReadyForSettlement({
        fullySyncedAt: null,
        kickoff,
        now: new Date(kickoff.getTime() + 3 * 60 * 60_000),
        status: "FINISHED"
      })
    ).toBe(true);
  });
});

describe("settleFinishedSpecialRounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.specialRound.update.mockResolvedValue({});
    prismaMock.specialRoundAuditLog.create.mockResolvedValue({});
    prismaMock.specialRoundResult.upsert.mockResolvedValue({});
  });

  it("nao apura rodadas finalizadas nem canceladas", () => {
    expect(settleableSpecialRoundStatuses).not.toContain("FINALIZED");
    expect(settleableSpecialRoundStatuses).not.toContain("CANCELLED");
  });

  it("deixa pendente a rodada cuja partida ainda nao consolidou", async () => {
    prismaMock.specialRound.findMany.mockResolvedValue([
      {
        id: "round-1",
        match: { fullySyncedAt: null, kickoff, status: "FINISHED" },
        name: "Rodada teste"
      }
    ]);

    const summary = await settleFinishedSpecialRounds(new Date(kickoff.getTime() + 60 * 60_000));

    expect(summary).toMatchObject({ finalized: 0, scanned: 1 });
    expect(summary.pending).toHaveLength(1);
    expect(prismaMock.specialRound.findUnique).not.toHaveBeenCalled();
  });

  it("vincula a partida sozinha quando a rodada foi criada sem catalogo", async () => {
    prismaMock.specialRound.findMany.mockResolvedValue([
      { id: "round-1", match: null, name: "Rodada teste" }
    ]);
    resolveMatchMock.mockResolvedValue({ id: "match-1" });
    prismaMock.match.findUnique.mockResolvedValue({
      fullySyncedAt: kickoff,
      kickoff,
      status: "FINISHED"
    });
    prismaMock.specialRound.findUnique.mockResolvedValue({
      ...catalogRound(),
      match: { ...catalogRound().match, homeScore: null }
    });

    const summary = await settleFinishedSpecialRounds(
      new Date(kickoff.getTime() + 3 * 60 * 60_000)
    );

    expect(resolveMatchMock).toHaveBeenCalledWith("round-1");
    expect(summary.pending[0]?.reason).toContain("catalogo");
  });

  it("deixa pendente a rodada sem partida encontrada no catalogo", async () => {
    prismaMock.specialRound.findMany.mockResolvedValue([
      { id: "round-1", match: null, name: "Rodada teste" }
    ]);
    resolveMatchMock.mockResolvedValue(null);

    const summary = await settleFinishedSpecialRounds(
      new Date(kickoff.getTime() + 3 * 60 * 60_000)
    );

    expect(summary.finalized).toBe(0);
    expect(summary.pending[0]?.reason).toContain("nao localizada");
    expect(prismaMock.specialRound.findUnique).not.toHaveBeenCalled();
  });

  it("deixa pendente quando o catalogo ainda nao tem todos os mercados", async () => {
    prismaMock.specialRound.findMany.mockResolvedValue([
      {
        id: "round-1",
        match: { fullySyncedAt: kickoff, kickoff, status: "FINISHED" },
        name: "Rodada teste"
      }
    ]);
    const round = catalogRound();
    prismaMock.specialRound.findUnique.mockResolvedValue({
      ...round,
      match: { ...round.match, homeScore: null }
    });

    const summary = await settleFinishedSpecialRounds(
      new Date(kickoff.getTime() + 3 * 60 * 60_000)
    );

    expect(summary.finalized).toBe(0);
    expect(summary.pending[0]?.reason).toContain("catalogo");
    expect(txMock.specialRound.update).not.toHaveBeenCalled();
  });

  it("homologa, apura e publica o campeao automaticamente", async () => {
    prismaMock.specialRound.findMany.mockResolvedValue([
      {
        id: "round-1",
        match: { fullySyncedAt: kickoff, kickoff, status: "FINISHED" },
        name: "Rodada teste"
      }
    ]);
    prismaMock.specialRound.findUnique.mockResolvedValue(catalogRound());
    txMock.specialRound.findUniqueOrThrow
      .mockResolvedValueOnce({
        adminFeePercent: 0,
        entries: [
          {
            amount: 10,
            id: "entry-1",
            predictions: [
              {
                answer: "HOME",
                marketId: "market-1",
                submittedAt: new Date("2026-08-09T17:00:00Z")
              }
            ],
            standing: null
          }
        ],
        fixedPrize: null,
        id: "round-1",
        markets: [
          {
            id: "market-1",
            kind: "MATCH_RESULT",
            line: null,
            points: 10,
            result: { answer: "HOME" }
          }
        ],
        prizeDistribution: [{ percent: 100, position: 1 }],
        prizeMode: "POOL",
        prizePoolPercent: 100,
        status: "AWAITING_RESULT"
      })
      .mockResolvedValueOnce({ id: "round-1", name: "Rodada teste", status: "CALCULATING" });
    txMock.specialRoundPrize.findFirst.mockResolvedValue(null);
    txMock.specialRoundPrize.findMany.mockResolvedValue([
      {
        amount: 10,
        confirmedAt: null,
        entry: { userId: "user-1" },
        id: "prize-1",
        specialRoundId: "round-1"
      }
    ]);
    txMock.specialRoundEntry.findMany.mockResolvedValue([
      { id: "entry-1", prize: { amount: 10, id: "prize-1" }, userId: "user-1" }
    ]);
    txMock.specialRoundStanding.findFirst.mockResolvedValue({
      entry: { user: { name: "Joao Pedro" } }
    });

    const summary = await settleFinishedSpecialRounds(
      new Date(kickoff.getTime() + 3 * 60 * 60_000)
    );

    expect(summary).toMatchObject({ finalized: 1, pending: [], scanned: 1 });
    expect(prismaMock.specialRound.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "AWAITING_RESULT" } })
    );
    expect(txMock.specialRoundStanding.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ entryId: "entry-1", position: 1, totalPoints: 10 })]
    });
    expect(txMock.specialRound.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FINALIZED" }) })
    );
    expect(txMock.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ body: expect.stringContaining("Campeao: Joao Pedro") })
        ])
      })
    );
  });

  it("credita o premio na carteira do ganhador e marca como pago", async () => {
    prismaMock.specialRound.findMany.mockResolvedValue([
      {
        id: "round-1",
        match: { fullySyncedAt: kickoff, kickoff, status: "FINISHED" },
        name: "Rodada teste"
      }
    ]);
    prismaMock.specialRound.findUnique.mockResolvedValue(catalogRound());
    txMock.specialRound.findUniqueOrThrow
      .mockResolvedValueOnce({
        adminFeePercent: 0,
        entries: [
          {
            amount: 10,
            id: "entry-1",
            predictions: [
              {
                answer: "HOME",
                marketId: "market-1",
                submittedAt: new Date("2026-08-09T17:00:00Z")
              }
            ],
            standing: null
          }
        ],
        fixedPrize: null,
        id: "round-1",
        markets: [
          {
            id: "market-1",
            kind: "MATCH_RESULT",
            line: null,
            points: 10,
            result: { answer: "HOME" }
          }
        ],
        prizeDistribution: [{ percent: 100, position: 1 }],
        prizeMode: "POOL",
        prizePoolPercent: 100,
        status: "AWAITING_RESULT"
      })
      .mockResolvedValueOnce({ id: "round-1", name: "Rodada teste", status: "CALCULATING" });
    txMock.specialRoundPrize.findFirst.mockResolvedValue(null);
    txMock.specialRoundPrize.findMany.mockResolvedValue([
      {
        amount: 10,
        confirmedAt: null,
        entry: { userId: "user-1" },
        id: "prize-1",
        specialRoundId: "round-1"
      }
    ]);
    txMock.specialRoundEntry.findMany.mockResolvedValue([
      { id: "entry-1", prize: { amount: 10, id: "prize-1" }, userId: "user-1" }
    ]);
    txMock.specialRoundStanding.findFirst.mockResolvedValue({
      entry: { user: { name: "Joao Pedro" } }
    });

    await settleFinishedSpecialRounds(new Date(kickoff.getTime() + 3 * 60 * 60_000));

    expect(creditWalletMock).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        amountCents: 1000,
        uniqueKey: "wallet:special-round:prize:prize-1",
        userId: "user-1"
      })
    );
    expect(txMock.specialRoundPrize.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAID" }),
        where: { id: "prize-1" }
      })
    );
    expect(txMock.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ body: expect.stringContaining("carteira") })
        ])
      })
    );
  });
});
