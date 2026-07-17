import type { MatchStatus } from "@prisma/client";

import type { ExternalFootballCoverage } from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export type FixtureSyncState = {
  coverage?: ExternalFootballCoverage | null;
  eventsSyncedAt?: Date | null;
  fullySyncedAt?: Date | null;
  historySyncedAt?: Date | null;
  kickoff: Date;
  lastSyncedAt?: Date | null;
  lineupsComplete?: boolean;
  lineupsSyncedAt?: Date | null;
  liveIntervalMs?: number;
  liveSyncedAt?: Date | null;
  playersSyncedAt?: Date | null;
  statisticsSyncedAt?: Date | null;
  status: MatchStatus;
};

export type FixtureSyncDecision = {
  events: boolean;
  fixture: boolean;
  history: boolean;
  lineups: boolean;
  players: boolean;
  reason: string;
  statistics: boolean;
};

function olderThan(value: Date | null | undefined, thresholdMs: number, now: Date) {
  return !value || now.getTime() - value.getTime() >= thresholdMs;
}

export function isLiveMatchStatus(status: MatchStatus) {
  return status === "LIVE" || status === "HALFTIME";
}

export function isTerminalMatchStatus(status: MatchStatus) {
  return status === "FINISHED" || status === "CANCELLED";
}

export function shouldSyncFixture(state: FixtureSyncState, now = new Date()): FixtureSyncDecision {
  const untilKickoff = state.kickoff.getTime() - now.getTime();
  const isLive = isLiveMatchStatus(state.status);
  const isFinished = state.status === "FINISHED";
  const isCancelled = state.status === "CANCELLED";
  const coverage = state.coverage;
  const lineupsCovered = coverage?.lineups !== false;
  const eventsCovered = coverage?.events !== false;
  const statisticsCovered = coverage?.statisticsFixtures !== false;
  const playersCovered = coverage?.statisticsPlayers !== false;

  if (state.fullySyncedAt && (isFinished || isCancelled)) {
    return {
      events: false,
      fixture: false,
      history: false,
      lineups: false,
      players: false,
      reason: "Partida finalizada e completamente sincronizada.",
      statistics: false
    };
  }

  if (isLive) {
    const liveIntervalMs = state.liveIntervalMs ?? MINUTE;
    return {
      events: eventsCovered && olderThan(state.eventsSyncedAt, liveIntervalMs, now),
      fixture: olderThan(state.liveSyncedAt, liveIntervalMs, now),
      history: false,
      lineups:
        lineupsCovered &&
        !state.lineupsComplete &&
        olderThan(state.lineupsSyncedAt, 5 * MINUTE, now),
      players: false,
      reason: "Partida ao vivo.",
      statistics:
        statisticsCovered &&
        olderThan(state.statisticsSyncedAt, Math.max(liveIntervalMs, 5 * MINUTE), now)
    };
  }

  if (isFinished) {
    return {
      events: eventsCovered && olderThan(state.eventsSyncedAt, 10 * MINUTE, now),
      fixture: olderThan(state.lastSyncedAt, 5 * MINUTE, now),
      history: olderThan(state.historySyncedAt, 12 * HOUR, now),
      lineups:
        lineupsCovered &&
        !state.lineupsComplete &&
        olderThan(state.lineupsSyncedAt, 30 * MINUTE, now),
      players: playersCovered && olderThan(state.playersSyncedAt, 30 * MINUTE, now),
      reason: "Partida encerrada aguardando consolidacao final.",
      statistics: statisticsCovered && olderThan(state.statisticsSyncedAt, 10 * MINUTE, now)
    };
  }

  if (isCancelled) {
    return {
      events: false,
      fixture: olderThan(state.lastSyncedAt, 6 * HOUR, now),
      history: false,
      lineups: false,
      players: false,
      reason: "Partida cancelada.",
      statistics: false
    };
  }

  const inLineupWindow = untilKickoff <= HOUR && untilKickoff >= -2 * HOUR;

  if (inLineupWindow) {
    return {
      events: false,
      fixture: olderThan(state.lastSyncedAt, 5 * MINUTE, now),
      history: olderThan(state.historySyncedAt, 24 * HOUR, now),
      lineups:
        lineupsCovered &&
        !state.lineupsComplete &&
        olderThan(state.lineupsSyncedAt, 5 * MINUTE, now),
      players: false,
      reason: "Partida proxima do inicio.",
      statistics: false
    };
  }

  if (untilKickoff <= 24 * HOUR && untilKickoff > HOUR) {
    return {
      events: false,
      fixture: olderThan(state.lastSyncedAt, HOUR, now),
      history: olderThan(state.historySyncedAt, 24 * HOUR, now),
      lineups: false,
      players: false,
      reason: "Partida no dia do jogo.",
      statistics: false
    };
  }

  return {
    events: false,
    fixture: olderThan(state.lastSyncedAt, 12 * HOUR, now),
    history: false,
    lineups: false,
    players: false,
    reason: "Partida futura distante.",
    statistics: false
  };
}
