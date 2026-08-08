import { describe, expect, it } from "vitest";

import {
  applyDetailMode,
  forceSelectedFixtureDetails,
  getFixtureSyncPriority,
  shouldRunBackgroundHistory
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

  it("does not repeat background history inside the thirty-minute window", () => {
    expect(shouldRunBackgroundHistory(new Date("2026-08-08T17:45:00.000Z"), now)).toBe(false);
  });

  it("releases one background history batch after thirty minutes", () => {
    expect(shouldRunBackgroundHistory(new Date("2026-08-08T17:30:00.000Z"), now)).toBe(true);
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
});
