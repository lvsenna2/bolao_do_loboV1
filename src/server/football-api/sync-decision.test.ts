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

  it("inicia a busca da escalacao trinta minutos antes do jogo", () => {
    const decision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        kickoff: new Date("2026-07-16T15:30:00.000Z"),
        lineupsComplete: false,
        status: "SCHEDULED"
      },
      now
    );

    expect(decision.fixture).toBe(true);
    expect(decision.lineups).toBe(true);
  });

  it("nao gasta chamada de escalacao antes da janela de trinta minutos", () => {
    const decision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        kickoff: new Date("2026-07-16T15:31:00.000Z"),
        lineupsComplete: false,
        status: "SCHEDULED"
      },
      now
    );

    expect(decision.fixture).toBe(true);
    expect(decision.lineups).toBe(false);
  });

  it("confirma novamente a escalacao nos dez minutos finais", () => {
    const decision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        kickoff: new Date("2026-07-16T15:10:00.000Z"),
        lineupsComplete: false,
        lineupsSyncedAt: new Date("2026-07-16T14:57:30.000Z"),
        status: "SCHEDULED"
      },
      now
    );

    expect(decision.lineups).toBe(true);
  });

  it("mantem throttling da fixture fora da janela critica", () => {
    const decision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        kickoff: new Date("2026-07-16T15:45:00.000Z"),
        lastSyncedAt: new Date("2026-07-16T14:58:30.000Z"),
        lineupsComplete: false,
        lineupsSyncedAt: new Date("2026-07-16T14:59:00.000Z"),
        status: "SCHEDULED"
      },
      now
    );

    expect(decision.fixture).toBe(false);
    expect(decision.lineups).toBe(false);
  });

  it("atualiza a fixture em toda execucao dentro da janela critica do kickoff", () => {
    // Cenario B: kickoff em 5 minutos e lastSyncedAt ha 1 minuto nao podem bloquear a consulta.
    const decision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        kickoff: new Date("2026-07-16T15:05:00.000Z"),
        lastSyncedAt: new Date("2026-07-16T14:59:00.000Z"),
        status: "SCHEDULED"
      },
      now
    );

    expect(decision.fixture).toBe(true);
  });

  it("segue consultando apos o kickoff enquanto a partida local nao virou LIVE", () => {
    const decision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        kickoff: new Date("2026-07-16T14:59:30.000Z"),
        lastSyncedAt: new Date("2026-07-16T14:59:15.000Z"),
        status: "SCHEDULED"
      },
      now
    );

    expect(decision.fixture).toBe(true);
  });

  it("limita a janela critica a dez minutos depois do kickoff", () => {
    const decision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        kickoff: new Date("2026-07-16T14:45:00.000Z"),
        lastSyncedAt: new Date("2026-07-16T14:59:30.000Z"),
        status: "SCHEDULED"
      },
      now
    );

    expect(decision.fixture).toBe(false);
  });

  it("nao aplica a janela critica a partidas adiadas", () => {
    // Cenario H: kickoff adiado atualizado pela API nao pode manter polling por minuto.
    const nearDecision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        kickoff: new Date("2026-07-16T15:05:00.000Z"),
        lastSyncedAt: new Date("2026-07-16T14:59:00.000Z"),
        status: "POSTPONED"
      },
      now
    );
    const rescheduledDecision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        kickoff: new Date("2026-07-19T15:00:00.000Z"),
        lastSyncedAt: new Date("2026-07-16T14:00:00.000Z"),
        status: "POSTPONED"
      },
      now
    );

    expect(nearDecision.fixture).toBe(false);
    expect(rescheduledDecision.fixture).toBe(false);
  });

  it("para de buscar escalacao completa", () => {
    const decision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        kickoff: new Date("2026-07-16T15:30:00.000Z"),
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

  it("garante consolidacao final mesmo quando timestamps vieram do live", () => {
    const syncedAt = new Date("2026-07-16T14:00:00.000Z");
    const decision = shouldSyncFixture(
      {
        coverage: fullCoverage,
        eventsSyncedAt: syncedAt,
        historySyncedAt: syncedAt,
        kickoff: new Date("2026-07-16T12:00:00.000Z"),
        lastSyncedAt: syncedAt,
        lineupsComplete: true,
        playersSyncedAt: syncedAt,
        statisticsSyncedAt: syncedAt,
        status: "FINISHED"
      },
      now
    );

    expect(decision.events).toBe(true);
    expect(decision.history).toBe(false);
    expect(decision.lineups).toBe(false);
    expect(decision.players).toBe(true);
    expect(decision.statistics).toBe(true);
    expect(decision.fixture).toBe(true);
  });

  it("encerra partida cancelada sem novas consultas periodicas", () => {
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
