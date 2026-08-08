import { describe, expect, it, vi } from "vitest";

import {
  applyDetailMode,
  applyTerminalFixtureDecision,
  claimBackgroundHistorySlot,
  forceSelectedFixtureDetails,
  getFixtureSyncPriority,
  isFinalConsolidationReady
} from "./automation-service";

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
