import { describe, expect, it } from "vitest";

import { applyDetailMode } from "./automation-service";

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
