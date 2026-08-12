import { describe, expect, it, vi } from "vitest";

import {
  applyDetailMode,
  applyLiveFixtureDecision,
  applyTerminalFixtureDecision,
  canAcceptEmptyEventsAsFinal,
  claimBackgroundHistorySlot,
  classifyFixtureDetailCategory,
  collectDueFixtureIds,
  countLiveFixturesFromApi,
  forceSelectedFixtureDetails,
  getFixtureSyncPriority,
  isFinalConsolidationReady,
  planDetailFetches,
  reconcileLiveFixtures,
  resolveDetailBudgets,
  selectLiveSyncCandidates,
  shouldQueueFixtureForAutomation,
  type FixtureDetailCategory
} from "./automation-service";
import type { ExternalFootballFixture } from "./types";

const emptyDecision = {
  events: false,
  fixture: true,
  history: false,
  lineups: false,
  players: false,
  reason: "Teste",
  statistics: false
};

describe("football automation detail mode", () => {
  it("keeps only lineups and history in the lightweight cron cycle", () => {
    const decision = applyDetailMode(
      {
        events: true,
        fixture: true,
        history: true,
        lineups: true,
        players: true,
        reason: "Partida encerrada.",
        statistics: true
      },
      "lineups-history"
    );

    expect(decision).toEqual({
      events: false,
      fixture: true,
      history: true,
      lineups: true,
      players: false,
      reason: "Partida encerrada.",
      statistics: false
    });
  });
});

describe("football automation history throttle", () => {
  const now = new Date("2026-08-08T18:00:00.000Z");

  it("persists the thirty-minute window and atomically rejects concurrent batches", async () => {
    let lockedUntil: Date | null = null;
    const store = {
      create: vi.fn(async ({ data }: { data: { lockedUntil: Date } }) => {
        if (lockedUntil) throw { code: "P2002" };
        lockedUntil = data.lockedUntil;
      }),
      updateMany: vi.fn(
        async ({ data, where }: { data: { lockedUntil: Date }; where: { lockedUntil: { lte: Date } } }) => {
          if (!lockedUntil || lockedUntil > where.lockedUntil.lte) return { count: 0 };
          lockedUntil = data.lockedUntil;
          return { count: 1 };
        }
      )
    };

    expect(await claimBackgroundHistorySlot(now, store)).toBe(true);
    expect(
      await claimBackgroundHistorySlot(new Date("2026-08-08T18:29:59.999Z"), store)
    ).toBe(false);

    const nextWindow = new Date("2026-08-08T18:30:00.000Z");
    const concurrent = await Promise.all([
      claimBackgroundHistorySlot(nextWindow, store),
      claimBackgroundHistorySlot(nextWindow, store)
    ]);
    expect(concurrent.filter(Boolean)).toHaveLength(1);
  });
});

describe("football automation terminal consolidation", () => {
  const coverage = {
    events: true,
    lineups: true,
    players: true,
    standings: true,
    statisticsFixtures: true,
    statisticsPlayers: true
  };

  it("forces one final detail pass after a live fixture becomes FT", () => {
    const decision = applyTerminalFixtureDecision(emptyDecision, "FT", coverage, false);

    expect(decision.events).toBe(true);
    expect(decision.fixture).toBe(true);
    expect(decision.lineups).toBe(true);
    expect(decision.players).toBe(true);
    expect(decision.statistics).toBe(true);
  });

  it("accepts only detail timestamps written during the final pass", () => {
    const startedAt = new Date("2026-08-08T18:00:00.000Z");
    const liveTimestamp = new Date("2026-08-08T17:59:59.000Z");
    const finalTimestamp = new Date("2026-08-08T18:00:01.000Z");

    expect(
      isFinalConsolidationReady(
        {
          eventsSyncedAt: liveTimestamp,
          lineupsComplete: false,
          lineupsSyncedAt: liveTimestamp,
          playersSyncedAt: liveTimestamp,
          statisticsSyncedAt: liveTimestamp
        },
        coverage,
        startedAt
      )
    ).toBe(false);
    expect(
      isFinalConsolidationReady(
        {
          eventsSyncedAt: finalTimestamp,
          lineupsComplete: false,
          lineupsSyncedAt: finalTimestamp,
          playersSyncedAt: finalTimestamp,
          statisticsSyncedAt: finalTimestamp
        },
        coverage,
        startedAt
      )
    ).toBe(true);
  });

  it.each(["CANC", "ABD"])("does not request unavailable details for %s", (status) => {
    const decision = applyTerminalFixtureDecision(
      { ...emptyDecision, events: true, lineups: true, players: true, statistics: true },
      status,
      coverage,
      false
    );

    expect(Object.values(decision).filter((value) => value === true)).toHaveLength(0);
  });
});

describe("football automation selected fixture", () => {
  it("forces result details even when the general cache is complete", () => {
    const decision = forceSelectedFixtureDetails(
      {
        events: false,
        fixture: false,
        history: false,
        lineups: false,
        players: false,
        reason: "Partida consolidada.",
        statistics: false
      },
      {
        events: true,
        lineups: true,
        players: true,
        standings: true,
        statisticsFixtures: true,
        statisticsPlayers: true
      }
    );

    expect(decision.fixture).toBe(true);
    expect(decision.events).toBe(true);
    expect(decision.statistics).toBe(true);
  });

  it("does not request unsupported event or statistic endpoints", () => {
    const decision = forceSelectedFixtureDetails(
      {
        events: false,
        fixture: false,
        history: false,
        lineups: false,
        players: false,
        reason: "Sem cobertura.",
        statistics: false
      },
      {
        events: false,
        lineups: false,
        players: false,
        standings: false,
        statisticsFixtures: false,
        statisticsPlayers: false
      }
    );

    expect(decision.fixture).toBe(true);
    expect(decision.events).toBe(false);
    expect(decision.statistics).toBe(false);
  });
});

describe("football automation fixture queueing", () => {
  it("counts live fixtures from the API payload even when the local record is still scheduled", () => {
    expect(
      countLiveFixturesFromApi([
        { statusShort: "1H" },
        { statusShort: "NS" },
        { statusShort: "HT" }
      ] as Array<{ statusShort: string }>)
    ).toBe(2);
  });

  it("keeps live and near-kickoff matches in the automation queue while skipping distant future backlog", () => {
    const now = new Date("2026-08-08T18:00:00.000Z");

    expect(
      shouldQueueFixtureForAutomation(
        {
          kickoff: new Date("2026-08-08T18:10:00.000Z"),
          specialRounds: [],
          status: "SCHEDULED"
        },
        { ...emptyDecision, fixture: true, lineups: true },
        now
      )
    ).toBe(true);

    expect(
      shouldQueueFixtureForAutomation(
        {
          kickoff: new Date("2026-08-15T18:10:00.000Z"),
          specialRounds: [],
          status: "SCHEDULED"
        },
        { ...emptyDecision, fixture: true },
        now
      )
    ).toBe(false);
  });

  it("mantem na fila partida agendada com status final publicado tardiamente", () => {
    const now = new Date("2026-08-08T18:00:00.000Z");

    expect(
      shouldQueueFixtureForAutomation(
        {
          kickoff: new Date("2026-08-08T15:30:00.000Z"),
          specialRounds: [],
          status: "SCHEDULED"
        },
        { ...emptyDecision, fixture: true },
        now
      )
    ).toBe(true);
  });
});

describe("football automation live discovery", () => {
  const now = new Date("2026-08-08T18:00:00.000Z");
  const fullCoverage = {
    events: true,
    lineups: true,
    players: true,
    standings: true,
    statisticsFixtures: true,
    statisticsPlayers: true
  };

  it("chama o endpoint live quando ha partida local SCHEDULED com kickoff ja iniciado", () => {
    // Cenario A: SCHEDULED com kickoff ha 30 segundos entra na descoberta live.
    const selection = selectLiveSyncCandidates(
      [
        {
          apiId: 101,
          kickoff: new Date("2026-08-08T17:59:30.000Z"),
          status: "SCHEDULED" as const
        }
      ],
      new Map(),
      now
    );

    expect(selection.discovery).toHaveLength(1);
    expect(selection.shouldCallLiveEndpoint).toBe(true);
  });

  it("nao chama o endpoint live sem candidato em janela relevante", () => {
    // Cenario G: nada ao vivo e nada perto do kickoff encerra sem chamada externa.
    const selection = selectLiveSyncCandidates(
      [
        {
          apiId: 101,
          kickoff: new Date("2026-08-08T19:00:00.000Z"),
          status: "SCHEDULED" as const
        },
        {
          apiId: 102,
          kickoff: new Date("2026-08-07T18:00:00.000Z"),
          status: "FINISHED" as const
        }
      ],
      new Map(),
      now
    );

    expect(selection.discovery).toHaveLength(0);
    expect(selection.shouldCallLiveEndpoint).toBe(false);
  });

  it("respeita o intervalo adaptativo quando so ha partidas ja LIVE sem consulta devida", () => {
    const selection = selectLiveSyncCandidates(
      [
        {
          apiId: 101,
          kickoff: new Date("2026-08-08T17:00:00.000Z"),
          status: "LIVE" as const
        }
      ],
      new Map([
        [
          101,
          {
            events: false,
            fixture: false,
            history: false,
            lineups: false,
            players: false,
            reason: "Intervalo live ainda vigente.",
            statistics: false
          }
        ]
      ]),
      now
    );

    expect(selection.localLive).toHaveLength(1);
    expect(selection.shouldCallLiveEndpoint).toBe(false);
  });

  it("reconcilia fixture live com candidato local ainda SCHEDULED", () => {
    // Cenario A: a API ja reporta 1H para uma partida local SCHEDULED.
    const { discovered, matched } = reconcileLiveFixtures(
      [
        { apiId: 101, status: "SCHEDULED" as const },
        { apiId: 202, status: "LIVE" as const }
      ],
      [
        { apiId: 101, statusShort: "1H" },
        { apiId: 202, statusShort: "2H" },
        { apiId: 999, statusShort: "1H" }
      ] as ExternalFootballFixture[]
    );

    expect(matched.map((fixture) => fixture.apiId)).toEqual([101, 202]);
    expect(discovered).toBe(1);
  });

  it("nao repete consulta por id para fixture ja obtida pelo endpoint live", () => {
    // Cenario D: fixture veio do live e nao pode entrar em fixtures?id=...
    const { dueIds, duplicatesAvoided } = collectDueFixtureIds([101, 102, 102], new Set([101]), 20);

    expect(dueIds).toEqual([102]);
    expect(duplicatesAvoided).toBe(1);
  });

  it("promove os detalhes de partida SCHEDULED que ja esta ao vivo na API", () => {
    const decision = applyLiveFixtureDecision(
      {
        events: false,
        fixture: true,
        history: false,
        lineups: true,
        players: false,
        reason: "Partida na janela critica do kickoff.",
        statistics: false
      },
      "1H",
      fullCoverage
    );

    expect(decision.fixture).toBe(true);
    expect(decision.events).toBe(true);
    expect(decision.statistics).toBe(true);
    expect(decision.lineups).toBe(true);
  });

  it("nao altera a decisao quando a API ainda nao reporta a partida ao vivo", () => {
    const original = {
      events: false,
      fixture: true,
      history: false,
      lineups: false,
      players: false,
      reason: "Partida proxima do inicio.",
      statistics: false
    };

    expect(applyLiveFixtureDecision(original, "NS", fullCoverage)).toBe(original);
  });
});

describe("football automation detail budgets", () => {
  it("separa budgets de live, pregame e final", () => {
    const budgets = resolveDetailBudgets(
      { finalDetailLimit: 1, liveDetailLimit: 2, pregameDetailLimit: 2 },
      15
    );

    expect(budgets).toEqual({ final: 1, live: 2, pregame: 2 });
  });

  it("usa detailLimit como fallback e nao excede o total de fixtures", () => {
    expect(resolveDetailBudgets({ detailLimit: 2 }, 1)).toEqual({ final: 1, live: 1, pregame: 1 });
    expect(resolveDetailBudgets({}, 3)).toEqual({ final: 3, live: 3, pregame: 3 });
  });

  it("classifica pelo status da API antes do status local", () => {
    expect(classifyFixtureDetailCategory({ localStatus: "SCHEDULED", statusShort: "1H" })).toBe(
      "live"
    );
    expect(classifyFixtureDetailCategory({ localStatus: "LIVE", statusShort: "FT" })).toBe("final");
    expect(classifyFixtureDetailCategory({ localStatus: "LIVE", statusShort: "HT" })).toBe("live");
    expect(classifyFixtureDetailCategory({ localStatus: "SCHEDULED", statusShort: "NS" })).toBe(
      "pregame"
    );
    expect(classifyFixtureDetailCategory({ localStatus: "FINISHED", statusShort: "FT" })).toBe(
      "final"
    );
  });

  it("nao deixa jogos live consumirem o budget das escalacoes pregame", () => {
    // Cenario C: 10 jogos live e 5 partidas prestes a comecar sem lineup.
    const fixtures = [
      ...Array.from({ length: 10 }, () => ({
        localStatus: "LIVE" as const,
        statusShort: "1H"
      })),
      ...Array.from({ length: 5 }, () => ({
        localStatus: "SCHEDULED" as const,
        statusShort: "NS"
      }))
    ];
    const budgets = resolveDetailBudgets(
      { finalDetailLimit: 1, liveDetailLimit: 2, pregameDetailLimit: 2 },
      fixtures.length
    );
    const processed: Record<FixtureDetailCategory, number> = { final: 0, live: 0, pregame: 0 };
    let pregameWaitingForBudget = 0;

    for (const fixture of fixtures) {
      const category = classifyFixtureDetailCategory(fixture);
      if (processed[category] < budgets[category]) {
        processed[category] += 1;
      } else if (category === "pregame") {
        pregameWaitingForBudget += 1;
      }
    }

    expect(processed.live).toBe(2);
    expect(processed.pregame).toBe(2);
    expect(pregameWaitingForBudget).toBe(3);
  });
});

describe("football automation embedded payload reuse", () => {
  const fullDecision = {
    events: true,
    fixture: true,
    history: false,
    lineups: true,
    players: true,
    reason: "Partida ao vivo.",
    statistics: true
  };

  it("reaproveita dados embutidos na resposta da fixture", () => {
    // Cenario E: fixture live ja contem events/statistics.
    const plan = planDetailFetches(fullDecision, {
      events: [{}],
      lineups: [{}],
      playerStatistics: [{}],
      statistics: [{}]
    } as unknown as ExternalFootballFixture);

    expect(plan).toEqual({
      fetchEvents: false,
      fetchLineups: false,
      fetchPlayers: false,
      fetchStatistics: false
    });
  });

  it("busca somente o que estiver pendente", () => {
    // Cenario F: consolidacao final consulta apenas os conjuntos ausentes.
    const plan = planDetailFetches(
      { ...fullDecision, lineups: false },
      {
        events: [],
        lineups: [],
        playerStatistics: [{}],
        statistics: []
      } as unknown as ExternalFootballFixture
    );

    expect(plan).toEqual({
      fetchEvents: true,
      fetchLineups: false,
      fetchPlayers: false,
      fetchStatistics: true
    });
  });
});

describe("football automation empty events grace", () => {
  const now = new Date("2026-08-08T18:00:00.000Z");

  it("nao consolida partida recem-encerrada com eventos vazios", () => {
    expect(canAcceptEmptyEventsAsFinal(new Date("2026-08-08T16:00:00.000Z"), now)).toBe(false);
  });

  it("aceita eventos vazios como definitivos depois da janela de tolerancia", () => {
    expect(canAcceptEmptyEventsAsFinal(new Date("2026-08-08T15:00:00.000Z"), now)).toBe(true);
  });
});

describe("football automation priority", () => {
  const now = new Date("2026-08-08T18:00:00.000Z");

  it("prioritizes the ten-minute lineup confirmation over finished backlog", () => {
    const lineup = getFixtureSyncPriority(
      {
        decision: { ...emptyDecision, lineups: true },
        hasActiveSpecialRound: false,
        kickoff: new Date("2026-08-08T18:10:00.000Z"),
        status: "SCHEDULED"
      },
      now
    );
    const finished = getFixtureSyncPriority(
      {
        decision: { ...emptyDecision, statistics: true },
        hasActiveSpecialRound: false,
        kickoff: new Date("2026-08-07T18:00:00.000Z"),
        status: "FINISHED"
      },
      now
    );

    expect(lineup).toBeLessThan(finished);
  });

  it("prioritizes live matches over every other detail", () => {
    const live = getFixtureSyncPriority(
      {
        decision: { ...emptyDecision, events: true, statistics: true },
        hasActiveSpecialRound: true,
        kickoff: new Date("2026-08-08T17:30:00.000Z"),
        status: "LIVE"
      },
      now
    );

    expect(live).toBe(0);
  });

  it("loads an active special round before the ordinary finished backlog", () => {
    const specialRound = getFixtureSyncPriority(
      {
        decision: { ...emptyDecision, history: true },
        hasActiveSpecialRound: true,
        kickoff: new Date("2026-08-09T00:00:00.000Z"),
        status: "SCHEDULED"
      },
      now
    );
    const finished = getFixtureSyncPriority(
      {
        decision: { ...emptyDecision, events: true, statistics: true },
        hasActiveSpecialRound: false,
        kickoff: new Date("2026-08-07T18:00:00.000Z"),
        status: "FINISHED"
      },
      now
    );

    expect(specialRound).toBeLessThan(finished);
  });

  it("prioritizes fixtures in the next 24 hours over finished backlog", () => {
    const gameDay = getFixtureSyncPriority(
      {
        decision: { ...emptyDecision, fixture: true },
        hasActiveSpecialRound: false,
        kickoff: new Date("2026-08-09T14:00:00.000Z"),
        status: "SCHEDULED"
      },
      now
    );
    const finished = getFixtureSyncPriority(
      {
        decision: { ...emptyDecision, statistics: true },
        hasActiveSpecialRound: false,
        kickoff: new Date("2026-08-07T18:00:00.000Z"),
        status: "FINISHED"
      },
      now
    );

    expect(gameDay).toBeLessThan(finished);
  });
});
