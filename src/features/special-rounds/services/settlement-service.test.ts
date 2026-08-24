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
      createMany: vi.fn(),
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
      footballSyncLock: {
        create: vi.fn(async () => ({})),
        deleteMany: vi.fn(async () => ({ count: 1 })),
        updateMany: vi.fn(async () => ({ count: 0 }))
      },
      match: { findUnique: vi.fn() },
      notification: { createMany: vi.fn(async () => ({})) },
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
      specialRoundEntry: { findMany: vi.fn(async (): Promise<unknown[]> => []) },
      specialRoundPrize: { findMany: vi.fn(async (): Promise<unknown[]> => []) },
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
  BONUS_ROLLOVER_MULTIPLIER: 10,
  creditWalletInTransaction: creditWalletMock,
  formatCents: (value: number) => `R$ ${(value / 100).toFixed(2)}`
}));

import {
  creditPendingFinalizedPrizes,
  creditSpecialRoundPrizeToWallet,
  isSpecialRoundMatchReadyForSettlement,
  settleFinishedSpecialRounds,
  settleableSpecialRoundStatuses
} from "./settlement-service";

const kickoff = new Date("2026-08-09T18:00:00Z");

/**
 * A varredura e a retomada de pagamento consultam a mesma tabela. O mock separa as duas pelo
 * filtro de status, para a rodada da varredura nao ser paga duas vezes dentro do teste.
 */
function mockScanRounds(rounds: unknown[]) {
  prismaMock.specialRound.findMany.mockImplementation(
    async (args?: { where?: { status?: string } }) =>
      args?.where?.status === "FINALIZED" ? [] : rounds
  );
}

describe("credito da promocao com rollover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devolve a aposta real e cria meta de 10x sobre o lucro", async () => {
    await creditSpecialRoundPrizeToWallet(
      txMock as never,
      {
        format: "PROMO_SINGLE_SELECTION",
        id: "round-promo",
        name: "Promocao teste",
        promoOdds: 2 as never
      },
      {
        amount: 10 as never,
        confirmedAt: null,
        entry: { amount: 5 as never, bonusAmount: 0 as never, userId: "user-1" },
        id: "prize-promo"
      }
    );

    expect(creditWalletMock).toHaveBeenNthCalledWith(
      1,
      txMock,
      expect.objectContaining({ amountCents: 500, bucket: "REAL", type: "REFUND" })
    );
    expect(creditWalletMock).toHaveBeenNthCalledWith(
      2,
      txMock,
      expect.objectContaining({
        amountCents: 500,
        bucket: "BONUS",
        rolloverRequirementCents: 5_000,
        type: "BONUS"
      })
    );
  });

  it("nao libera a parte apostada com bonus antes do rollover", async () => {
    await creditSpecialRoundPrizeToWallet(
      txMock as never,
      {
        format: "PROMO_SINGLE_SELECTION",
        id: "round-promo",
        name: "Promocao teste",
        promoOdds: 2 as never
      },
      {
        amount: 10 as never,
        confirmedAt: null,
        entry: { amount: 5 as never, bonusAmount: 5 as never, userId: "user-1" },
        id: "prize-promo"
      }
    );

    expect(creditWalletMock).toHaveBeenNthCalledWith(
      1,
      txMock,
      expect.objectContaining({ amountCents: 500, bucket: "ROLLOVER", type: "REFUND" })
    );
    expect(creditWalletMock).toHaveBeenNthCalledWith(
      2,
      txMock,
      expect.objectContaining({
        amountCents: 500,
        bucket: "BONUS",
        rolloverRequirementCents: 5_000
      })
    );
  });
});

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
    prismaMock.specialRoundPrize.findMany.mockResolvedValue([]);
    prismaMock.specialRoundEntry.findMany.mockResolvedValue([]);
    prismaMock.notification.createMany.mockResolvedValue({});
  });

  it("nao apura rodadas finalizadas nem canceladas", () => {
    expect(settleableSpecialRoundStatuses).not.toContain("FINALIZED");
    expect(settleableSpecialRoundStatuses).not.toContain("CANCELLED");
  });

  it("nao inicia outra homologacao enquanto uma varredura esta em andamento", async () => {
    prismaMock.footballSyncLock.create.mockRejectedValueOnce({ code: "P2002" });

    const summary = await settleFinishedSpecialRounds();

    expect(summary).toMatchObject({ finalized: 0, locked: true, scanned: 0 });
    expect(prismaMock.specialRound.findMany).not.toHaveBeenCalled();
    expect(prismaMock.footballSyncLock.deleteMany).not.toHaveBeenCalled();
  });

  it("deixa pendente a rodada cuja partida ainda nao consolidou", async () => {
    mockScanRounds([
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
    mockScanRounds([{ id: "round-1", match: null, name: "Rodada teste" }]);
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
    mockScanRounds([{ id: "round-1", match: null, name: "Rodada teste" }]);
    resolveMatchMock.mockResolvedValue(null);

    const summary = await settleFinishedSpecialRounds(
      new Date(kickoff.getTime() + 3 * 60 * 60_000)
    );

    expect(summary.finalized).toBe(0);
    expect(summary.pending[0]?.reason).toContain("nao localizada");
    expect(prismaMock.specialRound.findUnique).not.toHaveBeenCalled();
  });

  it("deixa pendente quando o catalogo ainda nao tem todos os mercados", async () => {
    mockScanRounds([
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
    mockScanRounds([
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
    prismaMock.specialRoundPrize.findMany.mockResolvedValue([
      {
        amount: 10,
        confirmedAt: null,
        entry: { userId: "user-1" },
        id: "prize-1",
        specialRoundId: "round-1"
      }
    ]);
    prismaMock.specialRoundEntry.findMany.mockResolvedValue([
      { id: "entry-1", prize: { amount: 10, id: "prize-1" }, userId: "user-1" }
    ]);
    prismaMock.specialRoundStanding.findFirst.mockResolvedValue({
      entry: { user: { name: "Joao Pedro" } }
    });

    const summary = await settleFinishedSpecialRounds(
      new Date(kickoff.getTime() + 3 * 60 * 60_000)
    );

    expect(summary).toMatchObject({ finalized: 1, pending: [], scanned: 1 });
    expect(prismaMock.specialRound.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "AWAITING_RESULT" } })
    );
    // Rodada que apurou nao pode continuar exibindo a falha da tentativa anterior.
    expect(prismaMock.specialRound.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ settlementError: null }),
        where: { id: "round-1" }
      })
    );
    expect(txMock.specialRoundStanding.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ entryId: "entry-1", position: 1, totalPoints: 10 })]
    });
    expect(txMock.specialRound.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FINALIZED" }) })
    );
    expect(prismaMock.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ body: expect.stringContaining("Campeao: Joao Pedro") })
        ])
      })
    );
  });

  it("credita o premio na carteira do ganhador e marca como pago", async () => {
    mockScanRounds([
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
    prismaMock.specialRoundPrize.findMany.mockResolvedValue([
      {
        amount: 10,
        confirmedAt: null,
        entry: { userId: "user-1" },
        id: "prize-1",
        specialRoundId: "round-1"
      }
    ]);
    prismaMock.specialRoundEntry.findMany.mockResolvedValue([
      { id: "entry-1", prize: { amount: 10, id: "prize-1" }, userId: "user-1" }
    ]);
    prismaMock.specialRoundStanding.findFirst.mockResolvedValue({
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
    expect(prismaMock.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ body: expect.stringContaining("carteira") })
        ])
      })
    );
  });
  it("paga em lotes a promocao com muitos ganhadores, fora da transacao da publicacao", async () => {
    const winners = Array.from({ length: 12 }, (_, index) => ({
      amount: 25,
      confirmedAt: null,
      entry: { amount: 10, bonusAmount: 0, userId: `user-${index}` },
      id: `prize-${index}`,
      specialRoundId: "round-promo"
    }));
    mockScanRounds([
      {
        id: "round-promo",
        match: { fullySyncedAt: kickoff, kickoff, status: "FINISHED" },
        name: "Promocao teste"
      }
    ]);
    prismaMock.specialRound.findUnique.mockResolvedValue(catalogRound());
    txMock.specialRound.findUniqueOrThrow
      .mockResolvedValueOnce({
        adminFeePercent: 0,
        entries: [],
        fixedPrize: null,
        format: "PROMO_SINGLE_SELECTION",
        id: "round-promo",
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
        prizeMode: "FIXED",
        prizePoolPercent: 100,
        promoOdds: 2.5,
        status: "AWAITING_RESULT"
      })
      .mockResolvedValueOnce({
        format: "PROMO_SINGLE_SELECTION",
        id: "round-promo",
        name: "Promocao teste",
        promoOdds: 2.5,
        status: "CALCULATING"
      });
    txMock.specialRoundPrize.findFirst.mockResolvedValue(null);
    prismaMock.specialRoundPrize.findMany.mockResolvedValue(winners);

    const summary = await settleFinishedSpecialRounds(
      new Date(kickoff.getTime() + 3 * 60 * 60_000)
    );

    expect(summary.finalized).toBe(1);
    // Um lote por vez: o pagamento nunca depende de uma unica transacao gigante.
    expect(prismaMock.specialRoundPrize.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ specialRoundId: "round-promo" }) })
    );
    expect(txMock.specialRoundPrize.update).toHaveBeenCalledTimes(12);
    // Dois creditos por ganhador na promocao: devolucao da aposta e lucro em bonus.
    expect(creditWalletMock).toHaveBeenCalledTimes(24);
  });

  it("retoma o pagamento de rodada ja publicada que ficou com premio pendente", async () => {
    prismaMock.specialRound.findMany.mockResolvedValue([
      {
        format: "PROMO_SINGLE_SELECTION",
        id: "round-promo",
        name: "Promocao teste",
        promoOdds: 2
      }
    ]);
    prismaMock.specialRoundPrize.findMany.mockResolvedValue([
      {
        amount: 20,
        confirmedAt: null,
        entry: { amount: 10, bonusAmount: 0, userId: "user-1" },
        id: "prize-pendente",
        specialRoundId: "round-promo"
      }
    ]);

    const recovered = await creditPendingFinalizedPrizes();

    expect(recovered).toBe(1);
    expect(txMock.specialRoundPrize.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAID" }),
        where: { id: "prize-pendente" }
      })
    );
  });

  // Sem rodizio, uma rodada antiga que nunca apura ocupa as 20 vagas da varredura para
  // sempre e nenhuma rodada nova chega a ser olhada.
  it("varre pela tentativa mais antiga, para rodada travada nao prender a fila", async () => {
    mockScanRounds([]);

    await settleFinishedSpecialRounds(new Date(kickoff.getTime() + 3 * 60 * 60_000));

    expect(prismaMock.specialRound.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { settlementAttemptedAt: { nulls: "first", sort: "asc" } },
          { matchStartsAt: "asc" }
        ]
      })
    );
  });

  it("guarda na rodada o motivo de nao ter homologado", async () => {
    mockScanRounds([{ id: "round-1", match: null, name: "Rodada teste" }]);
    resolveMatchMock.mockResolvedValue(null);

    await settleFinishedSpecialRounds(new Date(kickoff.getTime() + 3 * 60 * 60_000));

    expect(prismaMock.specialRound.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          settlementError: expect.stringContaining("nao localizada")
        }),
        where: { id: "round-1" }
      })
    );
  });

  // Premio zerado sem estado final mantinha a rodada eternamente na fila de recuperacao.
  it("encerra o premio sem valor em vez de deixa-lo pendente para sempre", async () => {
    const credited = await creditSpecialRoundPrizeToWallet(
      txMock as never,
      { format: "STANDARD", id: "round-1", name: "Rodada teste" },
      {
        amount: 0 as never,
        confirmedAt: null,
        entry: { amount: 10 as never, bonusAmount: 0 as never, userId: "user-1" },
        id: "prize-zero"
      }
    );

    expect(credited).toBe(false);
    expect(creditWalletMock).not.toHaveBeenCalled();
    expect(txMock.specialRoundPrize.update).toHaveBeenCalledWith({
      data: { status: "CANCELLED" },
      where: { id: "prize-zero" }
    });
  });
});
