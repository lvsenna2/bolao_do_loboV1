import { describe, expect, it } from "vitest";

import {
  applyTerminalFixtureDecision,
  forceSelectedFixtureDetails
} from "./automation-service";

const unavailableCoverage = {
  events: false,
  lineups: false,
  players: false,
  standings: false,
  statisticsFixtures: false,
  statisticsPlayers: false
};

const emptyDecision = {
  events: false,
  fixture: false,
  history: false,
  lineups: false,
  players: false,
  reason: "Sem cobertura.",
  statistics: false
};

describe("special-round result details", () => {
  it("forces result endpoints for a manually selected special-round fixture", () => {
    const selected = forceSelectedFixtureDetails(emptyDecision, unavailableCoverage, true);
    const terminal = applyTerminalFixtureDecision(
      selected,
      "FT",
      unavailableCoverage,
      false,
      true
    );

    expect(terminal.events).toBe(true);
    expect(terminal.statistics).toBe(true);
    expect(terminal.lineups).toBe(false);
    expect(terminal.players).toBe(false);
  });
});
