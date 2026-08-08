import { randomUUID } from "node:crypto";

import { Prisma, type MatchStatus } from "@prisma/client";

import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";

import {
  fetchApiFootballEvents,
  fetchApiFootballFixturePlayers,
  fetchApiFootballFixturesByIds,
  fetchApiFootballHeadToHead,
  fetchApiFootballLineups,
  fetchApiFootballLiveFixtures,
  fetchApiFootballStatistics,
  fetchApiFootballTeamFixtures,
  fetchApiFootballTeamStatistics,
  fetchApiFootballVenue
} from "./client";
import {
  footballCompetitionConfigs,
  getFootballCompetitionConfig,
  type FootballCompetitionConfig,
  type FootballCompetitionKey
} from "./competitions";
import {
  markFixturesFullySynced,
  saveFixtureEvents,
  saveFixtureInsights,
  saveFixtureLineups,
  saveFixturePlayerStatistics,
  saveFixtureStatistics,
  saveFixtureVenue
} from "./detail-service";
import { syncApiFootballCompetitionIntoLeagues } from "./league-sync-service";
import { getFootballApiUsageSnapshot } from "./request";
import { shouldSyncFixture, type FixtureSyncDecision } from "./sync-decision";
import { isApiFootballFinalStatus } from "./status";
import {
  applyFootballFixture,
  syncFootballCompetition,
  syncFootballCompetitionStandings
} from "./sync-service";
import type { ExternalFootballCoverage, ExternalFootballFixture } from "./types";

const AUTOMATION_KEY = "api-football-automatic";
const HISTORY_THROTTLE_KEY = "api-football-history-throttle";
export const FOOTBALL_MANUAL_TRIGGER = "admin-manual";
const LOCK_TTL_MS = 10 * 60_000;
const NEXT_RUN_MS = 30_000;
const MAX_CANDIDATES = 100;
const MINUTE_MS = 60_000;
const BACKGROUND_HISTORY_INTERVAL_MS = 30 * MINUTE_MS;
const STANDINGS_INTERVAL_MS = 30 * MINUTE_MS;

export type AutomationSummary = {
  backlogIsCapped: boolean;
  callsUsed: number;
  candidatesProcessed: number;
  catalogsSynced: number;
  detailsProcessed: number;
  errors: string[];
  fixturesFetched: number;
  fixturesUpdated: number;
  liveMatches: number;
  pendingFinalDetails: number;
  pendingLineups: number;
  remainingCandidates: number;
  trackedMatches: number;
};

export type FootballAutomationOptions = {
  competitionKey?: FootballCompetitionKey;
  detailLimit?: number;
  detailMode?: "full" | "lineups-history";
  fixtureLimit?: number;
  historyBudget?: number;
  includeCatalog?: boolean;
  matchId?: string;
};

type Candidate = Awaited<ReturnType<typeof loadCandidates>>[number];

export type FootballAutomationResult =
  | {
      locked: true;
      message: string;
      ok: true;
    }
  | {
      locked?: false;
      message: string;
      ok: boolean;
      runId: string;
      summary: AutomationSummary;
    };

function emptySummary(): AutomationSummary {
  return {
    backlogIsCapped: false,
    callsUsed: 0,
    candidatesProcessed: 0,
    catalogsSynced: 0,
    detailsProcessed: 0,
    errors: [],
    fixturesFetched: 0,
    fixturesUpdated: 0,
    liveMatches: 0,
    pendingFinalDetails: 0,
    pendingLineups: 0,
    remainingCandidates: 0,
    trackedMatches: 0
  };
}

type HistoryThrottleStore = {
  create(input: {
    data: { key: string; lockedUntil: Date; ownerToken: string };
  }): Promise<unknown>;
  updateMany(input: {
    data: { lockedUntil: Date; ownerToken: string };
    where: { key: string; lockedUntil: { lte: Date } };
  }): Promise<{ count: number }>;
};

function isUniqueConstraintError(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
    (typeof error === "object" && error !== null && "code" in error && error.code === "P2002")
  );
}

export async function claimBackgroundHistorySlot(
  now = serverNow(),
  store: HistoryThrottleStore = prisma.footballSyncLock as unknown as HistoryThrottleStore
) {
  const lockedUntil = new Date(now.getTime() + BACKGROUND_HISTORY_INTERVAL_MS);
  const ownerToken = randomUUID();

  try {
    await store.create({
      data: { key: HISTORY_THROTTLE_KEY, lockedUntil, ownerToken }
    });
    return true;
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
  }

  const claimed = await store.updateMany({
    data: { lockedUntil, ownerToken },
    where: {
      key: HISTORY_THROTTLE_KEY,
      lockedUntil: { lte: now }
    }
  });

  return claimed.count === 1;
}

function readRequestParam(value: Prisma.JsonValue | null, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const param = (value as Prisma.JsonObject)[key];
  return typeof param === "string" ? param : null;
}

async function getStandingsConfigDue(configs: FootballCompetitionConfig[], now: Date) {
  if (configs.length === 0) return null;
  const recent = await prisma.footballApiRequestLog.findMany({
    orderBy: { createdAt: "desc" },
    select: { params: true },
    take: 20,
    where: {
      createdAt: { gte: new Date(now.getTime() - STANDINGS_INTERVAL_MS) },
      endpoint: "standings",
      ok: true
    }
  });

  return (
    configs.find(
      (config) =>
        !recent.some(
          (request) =>
            readRequestParam(request.params, "league") === String(config.leagueId) &&
            readRequestParam(request.params, "season") === String(config.season)
        )
    ) ?? null
  );
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function parseCoverage(value: Prisma.JsonValue | null): ExternalFootballCoverage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const coverage = value as Record<string, unknown>;
  return {
    events: coverage.events === true,
    lineups: coverage.lineups === true,
    players: coverage.players === true,
    standings: coverage.standings === true,
    statisticsFixtures: coverage.statisticsFixtures === true,
    statisticsPlayers: coverage.statisticsPlayers === true
  };
}

function liveIntervalMs(dailyRemaining: number | null) {
  if (dailyRemaining === null || dailyRemaining > 70) return 60_000;
  if (dailyRemaining > 45) return 2 * 60_000;
  if (dailyRemaining > 25) return 3 * 60_000;
  return 5 * 60_000;
}

function configForCandidate(candidate: Candidate) {
  const leagueId = candidate.round.season.championship.apiId;
  return (
    footballCompetitionConfigs.find(
      (config) => config.leagueId === leagueId && config.season === candidate.round.season.year
    ) ?? null
  );
}

async function acquireLock(ownerToken: string, now: Date) {
  const lockedUntil = new Date(now.getTime() + LOCK_TTL_MS);

  try {
    await prisma.footballSyncLock.create({
      data: {
        key: AUTOMATION_KEY,
        lockedUntil,
        ownerToken
      }
    });
    return true;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
  }

  const recovered = await prisma.footballSyncLock.updateMany({
    data: {
      lockedUntil,
      ownerToken
    },
    where: {
      key: AUTOMATION_KEY,
      lockedUntil: {
        lt: now
      }
    }
  });

  if (recovered.count !== 1) return false;

  const interruptedMessage =
    "A execucao anterior excedeu o tempo do lock e foi substituida por um novo lote.";
  await prisma.footballAutomationLog.updateMany({
    data: {
      error: interruptedMessage,
      finishedAt: now,
      status: "FAILED"
    },
    where: {
      status: "RUNNING"
    }
  });

  return true;
}

async function releaseLock(ownerToken: string) {
  await prisma.footballSyncLock.deleteMany({
    where: {
      key: AUTOMATION_KEY,
      ownerToken
    }
  });
}

export async function isFootballAutomationRunning(now = serverNow()) {
  const lock = await prisma.footballSyncLock.findUnique({
    select: {
      lockedUntil: true
    },
    where: {
      key: AUTOMATION_KEY
    }
  });

  if (lock && lock.lockedUntil > now) {
    return true;
  }

  const interruptedMessage =
    "A execucao anterior foi interrompida antes de finalizar. Inicie novamente para continuar.";
  await prisma.$transaction([
    prisma.footballSyncState.updateMany({
      data: {
        lastError: interruptedMessage,
        lastFinishedAt: now,
        status: "FAILED"
      },
      where: {
        key: AUTOMATION_KEY,
        status: "RUNNING"
      }
    }),
    prisma.footballAutomationLog.updateMany({
      data: {
        error: interruptedMessage,
        finishedAt: now,
        status: "FAILED"
      },
      where: {
        status: "RUNNING"
      }
    })
  ]);

  return false;
}

const candidateSelect = Prisma.validator<Prisma.MatchSelect>()({
  apiId: true,
  eventsSyncedAt: true,
  fullySyncedAt: true,
  historySyncedAt: true,
  id: true,
  kickoff: true,
  lastSyncedAt: true,
  lineups: {
    select: {
      complete: true
    }
  },
  lineupsSyncedAt: true,
  liveSyncedAt: true,
  playersSyncedAt: true,
  round: {
    select: {
      season: {
        select: {
          championship: {
            select: {
              apiId: true,
              provider: true
            }
          },
          coverage: true,
          year: true
        }
      }
    }
  },
  specialRounds: {
    select: { id: true },
    take: 1,
    where: {
      status: {
        notIn: ["FINALIZED", "CANCELLED"]
      }
    }
  },
  statisticsSyncedAt: true,
  status: true
});

async function loadCandidates(
  configs = footballCompetitionConfigs,
  scanLimit = MAX_CANDIDATES,
  matchId?: string
) {
  const now = serverNow();
  const commonWhere: Prisma.MatchWhereInput = {
    apiId: {
      not: null
    },
    deletedAt: null,
    round: {
      leagueId: null,
      season: {
        OR: configs.map((config) => ({
          championship: {
            apiId: config.leagueId,
            provider: "api-football"
          },
          year: config.season
        }))
      }
    }
  };

  if (matchId) {
    return prisma.match.findMany({
      select: candidateSelect,
      take: 1,
      where: {
        ...commonWhere,
        id: matchId
      }
    });
  }

  const urgent = await prisma.match.findMany({
    orderBy: { kickoff: "asc" },
    select: candidateSelect,
    take: scanLimit,
    where: {
      ...commonWhere,
      OR: [
        {
          status: {
            in: ["LIVE", "HALFTIME", "SUSPENDED"]
          }
        },
        {
          kickoff: {
            gte: new Date(now.getTime() - 12 * 60 * 60_000),
            lte: new Date(now.getTime() + 48 * 60 * 60_000)
          }
        },
        {
          specialRounds: {
            some: {
              status: {
                notIn: ["FINALIZED", "CANCELLED"]
              }
            }
          }
        }
      ]
    }
  });
  const remainingSlots = Math.max(0, scanLimit - urgent.length);

  if (remainingSlots === 0) return urgent;

  const backlog = await prisma.match.findMany({
    orderBy: { kickoff: "desc" },
    select: candidateSelect,
    take: remainingSlots,
    where: {
      ...commonWhere,
      fullySyncedAt: null,
      id: { notIn: urgent.map((candidate) => candidate.id) },
      status: {
        in: ["FINISHED", "CANCELLED"]
      }
    }
  });

  return [...urgent, ...backlog];
}

function decisionNeedsWork(decision: FixtureSyncDecision) {
  return Boolean(
    decision.fixture ||
    decision.events ||
    decision.history ||
    decision.lineups ||
    decision.players ||
    decision.statistics
  );
}

function decisionNeedsDetails(decision: FixtureSyncDecision) {
  return Boolean(
    decision.events ||
    decision.history ||
    decision.lineups ||
    decision.players ||
    decision.statistics
  );
}

export function countLiveFixturesFromApi(fixtures: Array<{ statusShort?: string | null }>) {
  return fixtures.filter((fixture) => {
    const shortStatus = fixture.statusShort?.toUpperCase();
    return shortStatus === "1H" || shortStatus === "2H" || shortStatus === "ET" || shortStatus === "BT" || shortStatus === "P" || shortStatus === "LIVE" || shortStatus === "HT";
  }).length;
}

export function getFixtureSyncPriority(
  input: {
    decision: FixtureSyncDecision;
    hasActiveSpecialRound: boolean;
    kickoff: Date;
    status: MatchStatus;
  },
  now = serverNow()
) {
  const untilKickoff = input.kickoff.getTime() - now.getTime();

  if (["LIVE", "HALFTIME"].includes(input.status)) return 0;
  if (input.decision.lineups && untilKickoff <= 10 * MINUTE_MS) return 1;
  if (input.decision.lineups) return 2;
  if (untilKickoff <= 60 * MINUTE_MS && untilKickoff >= -2 * 60 * MINUTE_MS) return 3;
  if (input.hasActiveSpecialRound) return 4;
  if (untilKickoff <= 24 * 60 * MINUTE_MS && untilKickoff > 0) return 5;
  if (input.decision.history && untilKickoff > 0) return 5;
  if (input.status === "FINISHED") return 6;
  return 7;
}

export function shouldQueueFixtureForAutomation(
  candidate: Pick<Candidate, "kickoff" | "specialRounds" | "status">,
  decision: FixtureSyncDecision | undefined,
  now = serverNow()
) {
  if (!decision) return false;

  if (["LIVE", "HALFTIME"].includes(candidate.status)) {
    return Boolean(decision.fixture || decision.lineups || decision.events || decision.players || decision.statistics);
  }

  const untilKickoff = candidate.kickoff.getTime() - now.getTime();
  const hasActiveSpecialRound = candidate.specialRounds.length > 0;
  const isNearKickoff = untilKickoff <= 24 * 60 * MINUTE_MS && untilKickoff > -2 * 60 * MINUTE_MS;

  if (hasActiveSpecialRound) return true;
  if (decision.lineups && untilKickoff <= 10 * MINUTE_MS) return true;
  if (untilKickoff <= 60 * MINUTE_MS && untilKickoff >= -2 * 60 * MINUTE_MS) return true;
  if (isNearKickoff && (decision.fixture || decision.history || decision.lineups)) return true;
  if (candidate.status === "FINISHED") {
    return Boolean(decision.fixture || decision.events || decision.lineups || decision.players || decision.statistics);
  }

  return false;
}

function syncPriority(candidate: Candidate, decision: FixtureSyncDecision, now: Date) {
  return getFixtureSyncPriority(
    {
      decision,
      hasActiveSpecialRound: candidate.specialRounds.length > 0,
      kickoff: candidate.kickoff,
      status: candidate.status
    },
    now
  );
}

function oldestDetailSync(candidate: Candidate, decision: FixtureSyncDecision | undefined) {
  if (!decision) return Number.MAX_SAFE_INTEGER;
  const values = [
    decision.events ? candidate.eventsSyncedAt : undefined,
    decision.history ? candidate.historySyncedAt : undefined,
    decision.lineups ? candidate.lineupsSyncedAt : undefined,
    decision.players ? candidate.playersSyncedAt : undefined,
    decision.statistics ? candidate.statisticsSyncedAt : undefined
  ]
    .filter((value) => value !== undefined)
    .map((value) => value?.getTime() ?? 0);

  if (values.length === 0) return Number.MAX_SAFE_INTEGER;
  return Math.min(...values);
}

export function applyDetailMode(
  decision: FixtureSyncDecision,
  mode: FootballAutomationOptions["detailMode"]
) {
  if (mode !== "lineups-history") return decision;

  return {
    ...decision,
    events: false,
    players: false,
    statistics: false
  };
}

export function forceSelectedFixtureDetails(
  decision: FixtureSyncDecision,
  coverage: ExternalFootballCoverage | null
): FixtureSyncDecision {
  return {
    ...decision,
    events: coverage?.events !== false,
    fixture: true,
    reason: "Sincronizacao manual de uma partida.",
    statistics: coverage?.statisticsFixtures !== false
  };
}

export function applyTerminalFixtureDecision(
  decision: FixtureSyncDecision,
  statusShort: string,
  coverage: ExternalFootballCoverage | null,
  lineupsComplete: boolean
): FixtureSyncDecision {
  if (statusShort === "CANC" || statusShort === "ABD") {
    return {
      events: false,
      fixture: false,
      history: false,
      lineups: false,
      players: false,
      reason: "Partida cancelada ou abandonada.",
      statistics: false
    };
  }

  if (!isApiFootballFinalStatus(statusShort)) return decision;

  return {
    ...decision,
    events: coverage?.events !== false,
    fixture: true,
    lineups: coverage?.lineups !== false && !lineupsComplete,
    players: coverage?.statisticsPlayers !== false,
    reason: "Partida encerrada aguardando consolidacao final.",
    statistics: coverage?.statisticsFixtures !== false
  };
}

type FinalSyncState = {
  eventsSyncedAt: Date | null;
  lineupsComplete: boolean;
  lineupsSyncedAt: Date | null;
  playersSyncedAt: Date | null;
  statisticsSyncedAt: Date | null;
};

export function isFinalConsolidationReady(
  stored: FinalSyncState,
  coverage: ExternalFootballCoverage | null,
  consolidationStartedAt: Date
) {
  const syncedSinceStart = (value: Date | null) =>
    Boolean(value && value.getTime() >= consolidationStartedAt.getTime());

  return (
    (coverage?.events === false || syncedSinceStart(stored.eventsSyncedAt)) &&
    (coverage?.statisticsFixtures === false || syncedSinceStart(stored.statisticsSyncedAt)) &&
    (coverage?.statisticsPlayers === false || syncedSinceStart(stored.playersSyncedAt)) &&
    (coverage?.lineups === false ||
      stored.lineupsComplete ||
      syncedSinceStart(stored.lineupsSyncedAt))
  );
}

function decisionForCandidate(
  candidate: Candidate,
  remaining: number | null,
  now: Date,
  forceSelectedDetails = false
): FixtureSyncDecision {
  const decision = shouldSyncFixture(
    {
      coverage: parseCoverage(candidate.round.season.coverage),
      eventsSyncedAt: candidate.eventsSyncedAt,
      fullySyncedAt: candidate.fullySyncedAt,
      historySyncedAt: candidate.historySyncedAt,
      kickoff: candidate.kickoff,
      lastSyncedAt: candidate.lastSyncedAt,
      lineupsComplete:
        candidate.lineups.length >= 2 && candidate.lineups.every((lineup) => lineup.complete),
      lineupsSyncedAt: candidate.lineupsSyncedAt,
      liveIntervalMs: liveIntervalMs(remaining),
      liveSyncedAt: candidate.liveSyncedAt,
      playersSyncedAt: candidate.playersSyncedAt,
      statisticsSyncedAt: candidate.statisticsSyncedAt,
      status: candidate.status
    },
    now
  );

  if (!forceSelectedDetails) return decision;

  const historyExpired =
    !candidate.historySyncedAt ||
    now.getTime() - candidate.historySyncedAt.getTime() >= 12 * 60 * 60_000;

  return {
    ...forceSelectedFixtureDetails(decision, parseCoverage(candidate.round.season.coverage)),
    history: candidate.status !== "CANCELLED" && historyExpired
  };
}

async function syncHistory(
  fixture: ExternalFootballFixture,
  config: FootballCompetitionConfig,
  matchIds: string[],
  summary: AutomationSummary
) {
  const [homeRecent, awayRecent, headToHead, homeSeasonStats, awaySeasonStats] = await Promise.all([
    fetchApiFootballTeamFixtures(fixture.homeTeam.apiId, {
      last: 5,
      leagueId: config.leagueId,
      season: config.season
    }),
    fetchApiFootballTeamFixtures(fixture.awayTeam.apiId, {
      last: 5,
      leagueId: config.leagueId,
      season: config.season
    }),
    fetchApiFootballHeadToHead(fixture.homeTeam.apiId, fixture.awayTeam.apiId, 5),
    fetchApiFootballTeamStatistics(config.leagueId, config.season, fixture.homeTeam.apiId),
    fetchApiFootballTeamStatistics(config.leagueId, config.season, fixture.awayTeam.apiId)
  ]);

  summary.callsUsed +=
    homeRecent.callsUsed +
    awayRecent.callsUsed +
    headToHead.callsUsed +
    homeSeasonStats.callsUsed +
    awaySeasonStats.callsUsed;
  if (!homeRecent.ok) throw new Error(homeRecent.message);
  if (!awayRecent.ok) throw new Error(awayRecent.message);
  if (!headToHead.ok) throw new Error(headToHead.message);

  await saveFixtureInsights(matchIds, fixture.homeTeam.apiId, fixture.awayTeam.apiId, {
    awayRecent: awayRecent.data,
    awaySeasonStats: awaySeasonStats.ok ? awaySeasonStats.data : null,
    headToHead: headToHead.data,
    homeRecent: homeRecent.data,
    homeSeasonStats: homeSeasonStats.ok ? homeSeasonStats.data : null
  });
}

async function syncDetails(input: {
  candidate: Candidate;
  config: FootballCompetitionConfig;
  decision: FixtureSyncDecision;
  fixture: ExternalFootballFixture;
  historyAllowed: boolean;
  matchIds: string[];
  summary: AutomationSummary;
}) {
  const { candidate, config, decision, fixture, matchIds, summary } = input;
  const coverage = parseCoverage(candidate.round.season.coverage);
  const finalConsolidationStartedAt = isApiFootballFinalStatus(fixture.statusShort)
    ? serverNow()
    : null;

  if (fixture.venueId) {
    const venueExists = await prisma.footballVenue.findUnique({
      select: { id: true },
      where: { externalId: fixture.venueId }
    });
    if (!venueExists) {
      const venueResult = await fetchApiFootballVenue(fixture.venueId);
      summary.callsUsed += venueResult.callsUsed;
      if (venueResult.ok && venueResult.data[0]) {
        await saveFixtureVenue(matchIds, venueResult.data[0]);
      }
    }
  }

  if (decision.lineups) {
    let lineups = fixture.lineups;
    let lineupsLoaded = lineups.length > 0;
    if (lineups.length === 0) {
      const result = await fetchApiFootballLineups(fixture.apiId);
      summary.callsUsed += result.callsUsed;
      if (result.ok) {
        lineups = result.data;
        lineupsLoaded = true;
      } else {
        summary.errors.push(result.message);
      }
    }
    if (lineups.length > 0) await saveFixtureLineups(matchIds, lineups);
    else if (lineupsLoaded) {
      await prisma.match.updateMany({
        data: { lineupsSyncedAt: serverNow() },
        where: { id: { in: matchIds } }
      });
    }
  }

  if (decision.events) {
    let events = fixture.events;
    let eventsLoaded = events.length > 0;
    if (events.length === 0) {
      const result = await fetchApiFootballEvents(fixture.apiId);
      summary.callsUsed += result.callsUsed;
      if (result.ok) {
        events = result.data;
        eventsLoaded = true;
      } else {
        summary.errors.push(result.message);
      }
    }
    if (eventsLoaded) await saveFixtureEvents(matchIds, events);
  }

  if (decision.statistics) {
    let statistics = fixture.statistics;
    let statisticsLoaded = statistics.length > 0;
    if (statistics.length === 0) {
      const result = await fetchApiFootballStatistics(fixture.apiId);
      summary.callsUsed += result.callsUsed;
      if (result.ok) {
        statistics = result.data;
        statisticsLoaded = true;
      } else {
        summary.errors.push(result.message);
      }
    }
    if (statisticsLoaded) await saveFixtureStatistics(matchIds, statistics);
  }

  if (decision.players) {
    let players = fixture.playerStatistics;
    let playersLoaded = players.length > 0;
    if (players.length === 0) {
      const result = await fetchApiFootballFixturePlayers(fixture.apiId);
      summary.callsUsed += result.callsUsed;
      if (result.ok) {
        players = result.data;
        playersLoaded = true;
      } else {
        summary.errors.push(result.message);
      }
    }
    if (playersLoaded) await saveFixturePlayerStatistics(matchIds, players);
  }

  if (decision.history && input.historyAllowed) {
    await syncHistory(fixture, config, matchIds, summary);
  }

  if (fixture.statusShort === "CANC" || fixture.statusShort === "ABD") {
    await markFixturesFullySynced(matchIds);
    return;
  }

  if (finalConsolidationStartedAt) {
    const stored = await prisma.match.findUnique({
      select: {
        eventsSyncedAt: true,
        lineups: { select: { complete: true } },
        lineupsSyncedAt: true,
        playersSyncedAt: true,
        statisticsSyncedAt: true
      },
      where: { id: matchIds[0] }
    });

    if (
      stored &&
      isFinalConsolidationReady(
        {
          eventsSyncedAt: stored.eventsSyncedAt,
          lineupsComplete:
            stored.lineups.length >= 2 && stored.lineups.every((lineup) => lineup.complete),
          lineupsSyncedAt: stored.lineupsSyncedAt,
          playersSyncedAt: stored.playersSyncedAt,
          statisticsSyncedAt: stored.statisticsSyncedAt
        },
        coverage,
        finalConsolidationStartedAt
      )
    ) {
      await markFixturesFullySynced(matchIds);
    }
  }
}

async function maybeSyncOneCatalog(summary: AutomationSummary, dailyRemaining: number | null) {
  if (summary.liveMatches > 0 || (dailyRemaining !== null && dailyRemaining <= 40)) return;
  const cutoff = new Date(serverNow().getTime() - 24 * 60 * 60_000);
  const logs = await prisma.footballSyncLog.findMany({
    distinct: ["competitionKey"],
    orderBy: { finishedAt: "desc" },
    select: { competitionKey: true, finishedAt: true },
    where: {
      competitionKey: { in: footballCompetitionConfigs.map((config) => config.key) },
      status: "SUCCESS"
    }
  });
  const stale = footballCompetitionConfigs.find((config) => {
    const latest = logs.find((log) => log.competitionKey === config.key);
    return !latest?.finishedAt || latest.finishedAt < cutoff;
  });
  if (!stale) return;
  const result = await syncFootballCompetition(stale, { force: true });
  summary.callsUsed += result.summary.callsUsed;
  if (!result.ok) {
    summary.errors.push(result.message);
    return;
  }
  await syncApiFootballCompetitionIntoLeagues(stale);
}

async function syncManualCatalogs(
  summary: AutomationSummary,
  configs: FootballCompetitionConfig[]
) {
  for (const config of configs) {
    const result = await syncFootballCompetition(config, { force: true });
    summary.callsUsed += result.summary.callsUsed;

    if (!result.ok) {
      summary.errors.push(`${config.name}: ${result.message}`);
      continue;
    }

    await syncApiFootballCompetitionIntoLeagues(config);
    summary.catalogsSynced += 1;
  }
}

async function updateState(
  status: "RUNNING" | "SUCCESS" | "FAILED",
  summary: AutomationSummary,
  input: { error?: string | null; finishedAt?: Date; startedAt: Date }
) {
  const usage = await getFootballApiUsageSnapshot();
  await prisma.footballSyncState.upsert({
    create: {
      callsUsed: usage.callsToday,
      dailyRemaining: usage.dailyRemaining,
      key: AUTOMATION_KEY,
      lastError: input.error,
      lastFinishedAt: input.finishedAt,
      lastStartedAt: input.startedAt,
      lastSuccessAt: status === "SUCCESS" ? input.finishedAt : undefined,
      liveMatches: summary.liveMatches,
      nextRunAt: new Date((input.finishedAt ?? input.startedAt).getTime() + NEXT_RUN_MS),
      pendingFinalDetails: summary.pendingFinalDetails,
      pendingLineups: summary.pendingLineups,
      status,
      trackedMatches: summary.trackedMatches
    },
    update: {
      callsUsed: usage.callsToday,
      dailyRemaining: usage.dailyRemaining,
      lastError: input.error,
      lastFinishedAt: input.finishedAt,
      lastStartedAt: input.startedAt,
      ...(status === "SUCCESS" ? { lastSuccessAt: input.finishedAt } : {}),
      ...(status === "RUNNING"
        ? {}
        : {
            liveMatches: summary.liveMatches,
            pendingFinalDetails: summary.pendingFinalDetails,
            pendingLineups: summary.pendingLineups,
            trackedMatches: summary.trackedMatches
          }),
      nextRunAt: new Date((input.finishedAt ?? input.startedAt).getTime() + NEXT_RUN_MS),
      status
    },
    where: { key: AUTOMATION_KEY }
  });
}

export async function runFootballAutomation(
  trigger = "cron",
  options: FootballAutomationOptions = {}
): Promise<FootballAutomationResult> {
  const startedAt = serverNow();
  const selectedConfig = options.competitionKey
    ? getFootballCompetitionConfig(options.competitionKey)
    : null;
  const activeConfigs = selectedConfig ? [selectedConfig] : footballCompetitionConfigs;
  const candidateScanLimit = options.matchId ? 1 : selectedConfig ? 1_000 : MAX_CANDIDATES;

  if (options.competitionKey && !selectedConfig) {
    return {
      message: "Campeonato invalido para sincronizacao.",
      ok: false,
      runId: randomUUID(),
      summary: emptySummary()
    };
  }

  const ownerToken = randomUUID();
  const locked = await acquireLock(ownerToken, startedAt);

  if (!locked) {
    return {
      locked: true,
      message: "Uma sincronizacao automatica ja esta em andamento.",
      ok: true
    };
  }

  const runId = randomUUID();
  const summary = emptySummary();
  await prisma.footballAutomationLog.create({
    data: { runId, startedAt, status: "RUNNING", trigger }
  });
  await updateState("RUNNING", summary, { startedAt });

  try {
    const usage = await getFootballApiUsageSnapshot();

    if (trigger === FOOTBALL_MANUAL_TRIGGER && options.includeCatalog !== false) {
      await syncManualCatalogs(summary, activeConfigs);
    }

    const candidates = await loadCandidates(activeConfigs, candidateScanLimit, options.matchId);
    const now = serverNow();
    const cancelledCandidateIds = candidates
      .filter((candidate) => candidate.status === "CANCELLED" && !candidate.fullySyncedAt)
      .map((candidate) => candidate.id);
    if (cancelledCandidateIds.length > 0) {
      await markFixturesFullySynced(cancelledCandidateIds);
    }
    summary.trackedMatches = candidates.length;
    summary.pendingLineups = candidates.filter(
      (candidate) =>
        candidate.kickoff.getTime() - now.getTime() <= 30 * 60_000 &&
        candidate.kickoff.getTime() - now.getTime() >= -2 * 60 * 60_000 &&
        !(candidate.lineups.length >= 2 && candidate.lineups.every((lineup) => lineup.complete))
    ).length;
    summary.pendingFinalDetails = candidates.filter(
      (candidate) => candidate.status === "FINISHED" && !candidate.fullySyncedAt
    ).length;

    const rawDecisions = candidates.map((candidate) => [
      candidate.apiId as number,
      applyDetailMode(
        decisionForCandidate(candidate, usage.dailyRemaining, now, Boolean(options.matchId)),
        options.detailMode
      )
    ] as const);
    const historyRequested = rawDecisions.some(([, decision]) => decision.history);
    const historyHasBudget =
      (usage.dailyRemaining === null || usage.dailyRemaining > 35) &&
      (options.historyBudget ?? 1) > 0 &&
      (options.fixtureLimit ?? MAX_CANDIDATES) > 0;
    const automaticHistoryAllowed =
      !trigger.startsWith("vercel-") ||
      Boolean(options.matchId) ||
      (historyRequested && historyHasBudget && (await claimBackgroundHistorySlot(now)));
    const decisions = new Map(
      rawDecisions.map(([apiId, decision]) => [
        apiId,
        automaticHistoryAllowed ? decision : { ...decision, history: false }
      ])
    );
    const fixtures = new Map<number, ExternalFootballFixture>();
    const fixtureLimit = Math.max(0, Math.min(options.fixtureLimit ?? MAX_CANDIDATES, 20));
    const liveCandidates = candidates.filter(
      (candidate) => ["LIVE", "HALFTIME"].includes(candidate.status) && decisions.get(candidate.apiId as number)?.fixture
    );

    if (fixtureLimit > 0 && liveCandidates.length > 0) {
      const selectedLiveIds = new Set(
        liveCandidates.slice(0, fixtureLimit).map((candidate) => candidate.apiId as number)
      );
      const liveResult = await fetchApiFootballLiveFixtures(
        activeConfigs.map((config) => config.leagueId)
      );
      summary.callsUsed += liveResult.callsUsed;
      if (liveResult.ok) {
        liveResult.data
          .filter((fixture) => selectedLiveIds.has(fixture.apiId))
          .forEach((fixture) => fixtures.set(fixture.apiId, fixture));
      } else summary.errors.push(liveResult.message);
    }

    summary.liveMatches = countLiveFixturesFromApi(Array.from(fixtures.values()));

    const dueCandidates = candidates
      .filter((candidate) => {
        const decision = decisions.get(candidate.apiId as number);
        const isLive = ["LIVE", "HALFTIME"].includes(candidate.status);
        const missedLive =
          isLive &&
          !fixtures.has(candidate.apiId as number) &&
          (!candidate.liveSyncedAt ||
            now.getTime() - candidate.liveSyncedAt.getTime() >= 30_000);
        return missedLive || (isLive && Boolean(decision?.fixture)) || shouldQueueFixtureForAutomation(candidate, decision, now);
      })
      .sort((left, right) => {
        const leftDecision = decisions.get(left.apiId as number);
        const rightDecision = decisions.get(right.apiId as number);
        if (!leftDecision || !rightDecision) return 0;
        const priorityDifference =
          syncPriority(left, leftDecision, now) - syncPriority(right, rightDecision, now);
        if (priorityDifference !== 0) return priorityDifference;
        return left.kickoff.getTime() - right.kickoff.getTime();
      });
    const remainingFixtureLimit =
      options.detailMode === "lineups-history" && fixtures.size === 0
        ? Math.min(fixtureLimit, 1)
        : fixtureLimit;
    const dueIds = Array.from(
      new Set(
        dueCandidates
          .filter((candidate) => !fixtures.has(candidate.apiId as number))
          .map((candidate) => candidate.apiId as number)
      )
    ).slice(0, Math.max(0, remainingFixtureLimit - fixtures.size));

    for (const fixtureIds of chunk(dueIds, 20)) {
      const result = await fetchApiFootballFixturesByIds(fixtureIds, "CRITICAL");
      summary.callsUsed += result.callsUsed;
      if (result.ok) result.data.forEach((fixture) => fixtures.set(fixture.apiId, fixture));
      else summary.errors.push(result.message);
    }

    let historyBudget =
      usage.dailyRemaining === null || usage.dailyRemaining > 35
        ? Math.max(0, Math.min(options.historyBudget ?? 1, fixtureLimit))
        : 0;
    const standingsConfigs = new Map<string, FootballCompetitionConfig>();

    const orderedFixtures = [...fixtures.values()].sort((left, right) => {
      const leftCandidate = candidates.find((item) => item.apiId === left.apiId);
      const rightCandidate = candidates.find((item) => item.apiId === right.apiId);
      if (!leftCandidate || !rightCandidate) return 0;
      const leftDecision = decisions.get(left.apiId);
      const rightDecision = decisions.get(right.apiId);
      if (!leftDecision || !rightDecision) return 0;
      const priorityDifference =
        syncPriority(leftCandidate, leftDecision, now) -
        syncPriority(rightCandidate, rightDecision, now);
      if (priorityDifference !== 0) return priorityDifference;
      const oldestDifference =
        oldestDetailSync(leftCandidate, decisions.get(left.apiId)) -
        oldestDetailSync(rightCandidate, decisions.get(right.apiId));
      if (oldestDifference !== 0) return oldestDifference;
      return leftCandidate.kickoff.getTime() - rightCandidate.kickoff.getTime();
    });
    const detailLimit = Math.max(
      0,
      Math.min(options.detailLimit ?? orderedFixtures.length, orderedFixtures.length)
    );
    let detailedFixtures = 0;

    for (const fixture of orderedFixtures) {
      const candidate = candidates.find((item) => item.apiId === fixture.apiId);
      if (!candidate) continue;
      const config = configForCandidate(candidate);
      if (!config) continue;

      try {
        const applied = await applyFootballFixture(config, fixture);
        if (applied.matchIds.length === 0) continue;
        const baseDecision = decisions.get(fixture.apiId);
        if (!baseDecision) continue;
        const decision = applyTerminalFixtureDecision(
          baseDecision,
          fixture.statusShort,
          parseCoverage(candidate.round.season.coverage),
          candidate.lineups.length >= 2 && candidate.lineups.every((lineup) => lineup.complete)
        );
        if (fixture.statusShort === "CANC" || fixture.statusShort === "ABD") {
          await markFixturesFullySynced(applied.matchIds);
        }
        if (decisionNeedsDetails(decision) && detailedFixtures < detailLimit) {
          const historyAllowed = decision.history && historyBudget > 0;
          if (historyAllowed) historyBudget -= 1;
          await syncDetails({
            candidate,
            config,
            decision,
            fixture,
            historyAllowed,
            matchIds: applied.matchIds,
            summary
          });
          detailedFixtures += 1;
          summary.detailsProcessed += 1;
        }
        summary.fixturesUpdated += applied.matchIds.length;
        summary.candidatesProcessed += 1;
        if (isApiFootballFinalStatus(fixture.statusShort)) {
          standingsConfigs.set(config.key, config);
        }
      } catch (error) {
        summary.errors.push(
          `${fixture.apiId}: ${error instanceof Error ? error.message : "Falha ao salvar partida"}`
        );
      }
    }

    summary.fixturesFetched = fixtures.size;

    if (standingsConfigs.size > 0 && (usage.dailyRemaining === null || usage.dailyRemaining > 20)) {
      const config = await getStandingsConfigDue([...standingsConfigs.values()], now);
      if (config) {
        const standings = await syncFootballCompetitionStandings(config);
        summary.callsUsed += standings.callsUsed;
      }
    }

    if (trigger !== FOOTBALL_MANUAL_TRIGGER && options.includeCatalog !== false) {
      await maybeSyncOneCatalog(summary, usage.dailyRemaining);
    }

    const remainingCandidates = await loadCandidates(
      activeConfigs,
      candidateScanLimit,
      options.matchId
    );
    const remainingNow = serverNow();
    summary.remainingCandidates = remainingCandidates.filter((candidate) =>
      decisionNeedsWork(decisionForCandidate(candidate, usage.dailyRemaining, remainingNow))
    ).length;
    summary.backlogIsCapped = !options.matchId && remainingCandidates.length === candidateScanLimit;

    const finishedAt = serverNow();
    const scopeLabel = selectedConfig ? `${selectedConfig.name}: ` : "";
    const backlogLabel = `${summary.remainingCandidates}${summary.backlogIsCapped ? "+" : ""}`;
    const catalogLabel =
      summary.catalogsSynced > 0 ? `${summary.catalogsSynced} campeonato(s) atualizado(s); ` : "";
    const message = `${scopeLabel}${catalogLabel}${summary.fixturesFetched} partida(s) consultada(s) na API; ${summary.fixturesUpdated} registro(s) local(is) revisado(s); ${summary.detailsProcessed} partida(s) com detalhes processados; ${summary.liveMatches} jogo(s) ao vivo; ${backlogLabel} pendencia(s) na fila analisada; ${summary.callsUsed} chamada(s) externa(s).`;
    const status = summary.errors.length > 0 ? "FAILED" : "SUCCESS";
    await prisma.footballAutomationLog.update({
      data: {
        callsUsed: summary.callsUsed,
        error: summary.errors.slice(0, 5).join(" | ") || null,
        finishedAt,
        liveMatches: summary.liveMatches,
        message,
        pendingFinalDetails: summary.pendingFinalDetails,
        pendingLineups: summary.pendingLineups,
        status,
        trackedMatches: summary.trackedMatches
      },
      where: { runId }
    });
    await updateState(status, summary, {
      error: summary.errors.slice(0, 5).join(" | ") || null,
      finishedAt,
      startedAt
    });

    return { message, ok: status === "SUCCESS", runId, summary };
  } catch (error) {
    const finishedAt = serverNow();
    const message = error instanceof Error ? error.message : "Falha inesperada na automacao.";
    summary.errors.push(message);
    await prisma.footballAutomationLog.update({
      data: { error: message, finishedAt, status: "FAILED" },
      where: { runId }
    });
    await updateState("FAILED", summary, { error: message, finishedAt, startedAt });
    return { message, ok: false, runId, summary };
  } finally {
    await releaseLock(ownerToken);
  }
}
