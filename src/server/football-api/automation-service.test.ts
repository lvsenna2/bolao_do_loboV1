import { describe, expect, it } from "vitest";

import { applyDetailMode, forceSelectedFixtureDetails } from "./automation-service";

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
