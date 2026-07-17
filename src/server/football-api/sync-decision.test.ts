import { describe, expect, it } from "vitest";

import { shouldSyncFixture } from "./sync-decision";

const now = new Date("2026-07-16T15:00:00.000Z");
const fullCoverage = {
  events: true,
  lineups: true,
  players: true,
  standings: true,
  statisticsFixtures: true,
  statisticsPlayers: true
};

describe("shouldSyncFixture", () => {
  it("atualiza partida ao vivo quando o intervalo venceu", () => {
    const decision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        kickoff: new Date("2026-07-16T14:30:00.000Z"),
        liveIntervalMs: 60_000,
        liveSyncedAt: new Date("2026-07-16T14:58:00.000Z"),
        status: "LIVE"
      },
      now
    );

    expect(decision.fixture).toBe(true);
    expect(decision.events).toBe(true);
  });

  it("nao repete polling ao vivo antes do intervalo", () => {
    const decision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        eventsSyncedAt: new Date("2026-07-16T14:59:30.000Z"),
        kickoff: new Date("2026-07-16T14:30:00.000Z"),
        liveIntervalMs: 60_000,
        liveSyncedAt: new Date("2026-07-16T14:59:30.000Z"),
        statisticsSyncedAt: new Date("2026-07-16T14:59:30.000Z"),
        status: "HALFTIME"
      },
      now
    );

    expect(decision.fixture).toBe(false);
    expect(decision.events).toBe(false);
    expect(decision.statistics).toBe(false);
  });

  it("busca escalacao na hora anterior ao jogo", () => {
    const decision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        kickoff: new Date("2026-07-16T15:45:00.000Z"),
        lineupsComplete: false,
        status: "SCHEDULED"
      },
      now
    );

    expect(decision.fixture).toBe(true);
    expect(decision.lineups).toBe(true);
  });

  it("para de buscar escalacao completa", () => {
    const decision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        kickoff: new Date("2026-07-16T15:45:00.000Z"),
        lineupsComplete: true,
        status: "SCHEDULED"
      },
      now
    );

    expect(decision.lineups).toBe(false);
  });

  it("respeita competicao sem cobertura de detalhes", () => {
    const decision = shouldSyncFixture(
      {
        coverage: {
          ...fullCoverage,
          events: false,
          lineups: false,
          statisticsFixtures: false,
          statisticsPlayers: false
        },
        kickoff: new Date("2026-07-16T14:00:00.000Z"),
        status: "FINISHED"
      },
      now
    );

    expect(decision.events).toBe(false);
    expect(decision.lineups).toBe(false);
    expect(decision.players).toBe(false);
    expect(decision.statistics).toBe(false);
  });

  it("nao consulta novamente partida finalizada e consolidada", () => {
    const decision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        fullySyncedAt: new Date("2026-07-16T14:50:00.000Z"),
        kickoff: new Date("2026-07-16T12:00:00.000Z"),
        status: "FINISHED"
      },
      now
    );

    expect(Object.values(decision).filter((value) => value === true)).toHaveLength(0);
  });

  it("faz apenas verificacao moderada para partida cancelada", () => {
    const decision = shouldSyncFixture(
      {
        kickoff: new Date("2026-07-16T12:00:00.000Z"),
        lastSyncedAt: new Date("2026-07-16T14:00:00.000Z"),
        status: "CANCELLED"
      },
      now
    );

    expect(decision.fixture).toBe(false);
    expect(decision.events).toBe(false);
  });

  it("atualiza poucas vezes partidas futuras distantes", () => {
    const decision = shouldSyncFixture(
      {
        kickoff: new Date("2026-07-20T15:00:00.000Z"),
        lastSyncedAt: new Date("2026-07-16T10:00:00.000Z"),
        status: "SCHEDULED"
      },
      now
    );

    expect(decision.fixture).toBe(false);
  });
});
