import type { MatchStatus } from "@prisma/client";

import type { ExternalFootballCoverage } from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const LINEUP_INITIAL_WINDOW = 30 * MINUTE;
const LINEUP_CONFIRMATION_WINDOW = 10 * MINUTE;
const CRITICAL_WINDOW_BEFORE_KICKOFF = 15 * MINUTE;
const CRITICAL_WINDOW_AFTER_KICKOFF = 10 * MINUTE;
const DELAYED_STATUS_RECOVERY_START = 2 * HOUR;
const DELAYED_STATUS_RECOVERY_END = 12 * HOUR;
const DELAYED_STATUS_RECOVERY_INTERVAL = 5 * MINUTE;

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

export function isWithinCriticalKickoffWindow(kickoff: Date, now = new Date()) {
  const untilKickoff = kickoff.getTime() - now.getTime();
  return (
    untilKickoff <= CRITICAL_WINDOW_BEFORE_KICKOFF && untilKickoff >= -CRITICAL_WINDOW_AFTER_KICKOFF
  );
}

export function isWithinDelayedStatusRecoveryWindow(kickoff: Date, now = new Date()) {
  const elapsedSinceKickoff = now.getTime() - kickoff.getTime();
  return (
    elapsedSinceKickoff > DELAYED_STATUS_RECOVERY_START &&
    elapsedSinceKickoff <= DELAYED_STATUS_RECOVERY_END
  );
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
    const liveIntervalMs = state.liveIntervalMs ?? 30_000;
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
      events: eventsCovered,
      fixture: true,
      history: !state.historySyncedAt,
      lineups: lineupsCovered && !state.lineupsComplete,
      players: playersCovered,
      reason: "Partida encerrada aguardando consolidacao final.",
      statistics: statisticsCovered
    };
  }

  if (isCancelled) {
    return {
      events: false,
      fixture: false,
      history: false,
      lineups: false,
      players: false,
      reason: "Partida cancelada.",
      statistics: false
    };
  }

  const inPregameWindow = untilKickoff <= HOUR && untilKickoff >= -2 * HOUR;

  if (inPregameWindow) {
    const inCriticalWindow =
      state.status === "SCHEDULED" && isWithinCriticalKickoffWindow(state.kickoff, now);
    const fixtureInterval = untilKickoff <= 15 * MINUTE ? 2 * MINUTE : 5 * MINUTE;
    const lineupInterval = untilKickoff <= LINEUP_CONFIRMATION_WINDOW ? 2 * MINUTE : 5 * MINUTE;
    const shouldCheckLineup = untilKickoff <= LINEUP_INITIAL_WINDOW;

    return {
      events: false,
      fixture: inCriticalWindow || olderThan(state.lastSyncedAt, fixtureInterval, now),
      history: olderThan(state.historySyncedAt, 24 * HOUR, now),
      lineups:
        lineupsCovered &&
        shouldCheckLineup &&
        !state.lineupsComplete &&
        olderThan(state.lineupsSyncedAt, lineupInterval, now),
      players: false,
      reason: inCriticalWindow
        ? "Partida na janela critica do kickoff."
        : "Partida proxima do inicio.",
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

  if (
    state.status === "SCHEDULED" &&
    isWithinDelayedStatusRecoveryWindow(state.kickoff, now)
  ) {
    return {
      events: false,
      fixture: olderThan(state.lastSyncedAt, DELAYED_STATUS_RECOVERY_INTERVAL, now),
      history: false,
      lineups: false,
      players: false,
      reason: "Partida apos o kickoff aguardando status definitivo.",
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
