import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

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
import {
  applyFootballFixture,
  syncFootballCompetition,
  syncFootballCompetitionStandings
} from "./sync-service";
import type { ExternalFootballCoverage, ExternalFootballFixture } from "./types";

const AUTOMATION_KEY = "api-football-automatic";
export const FOOTBALL_MANUAL_TRIGGER = "admin-manual";
const LOCK_TTL_MS = 2 * 60_000;
const NEXT_RUN_MS = 60_000;
const MAX_CANDIDATES = 100;

export type AutomationSummary = {
  callsUsed: number;
  candidatesProcessed: number;
  catalogsSynced: number;
  errors: string[];
  fixturesUpdated: number;
  liveMatches: number;
  pendingFinalDetails: number;
  pendingLineups: number;
  remainingCandidates: number;
  trackedMatches: number;
};

export type FootballAutomationOptions = {
  competitionKey?: FootballCompetitionKey;
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
    callsUsed: 0,
    candidatesProcessed: 0,
    catalogsSynced: 0,
    errors: [],
    fixturesUpdated: 0,
    liveMatches: 0,
    pendingFinalDetails: 0,
    pendingLineups: 0,
    remainingCandidates: 0,
    trackedMatches: 0
  };
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

  return recovered.count === 1;
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

async function loadCandidates(
  configs = footballCompetitionConfigs,
  scanLimit = MAX_CANDIDATES,
  matchId?: string
) {
  const now = serverNow();
  return prisma.match.findMany({
    orderBy: {
      kickoff: "asc"
    },
    select: {
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
      statisticsSyncedAt: true,
      status: true
    },
    take: scanLimit,
    where: {
      apiId: {
        not: null
      },
      deletedAt: null,
      ...(matchId ? { id: matchId } : {}),
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
      },
      ...(matchId
        ? {}
        : {
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
                fullySyncedAt: null,
                status: {
                  in: ["FINISHED", "CANCELLED"]
                }
              }
            ]
          })
    }
  });
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
    ...decision,
    fixture: true,
    history: candidate.status !== "CANCELLED" && historyExpired,
    reason: "Sincronizacao manual de uma partida."
  };
}

async function syncHistory(
  fixture: ExternalFootballFixture,
  config: FootballCompetitionConfig,
  matchIds: string[],
  summary: AutomationSummary
) {
  const homeRecent = await fetchApiFootballTeamFixtures(fixture.homeTeam.apiId, {
    last: 5,
    leagueId: config.leagueId,
    season: config.season
  });
  summary.callsUsed += homeRecent.callsUsed;
  if (!homeRecent.ok) throw new Error(homeRecent.message);

  const awayRecent = await fetchApiFootballTeamFixtures(fixture.awayTeam.apiId, {
    last: 5,
    leagueId: config.leagueId,
    season: config.season
  });
  summary.callsUsed += awayRecent.callsUsed;
  if (!awayRecent.ok) throw new Error(awayRecent.message);

  const headToHead = await fetchApiFootballHeadToHead(
    fixture.homeTeam.apiId,
    fixture.awayTeam.apiId,
    5
  );
  summary.callsUsed += headToHead.callsUsed;
  if (!headToHead.ok) throw new Error(headToHead.message);

  const homeSeasonStats = await fetchApiFootballTeamStatistics(
    config.leagueId,
    config.season,
    fixture.homeTeam.apiId
  );
  summary.callsUsed += homeSeasonStats.callsUsed;

  const awaySeasonStats = await fetchApiFootballTeamStatistics(
    config.leagueId,
    config.season,
    fixture.awayTeam.apiId
  );
  summary.callsUsed += awaySeasonStats.callsUsed;

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

  if (["FT", "AET", "PEN", "AWD", "WO"].includes(fixture.statusShort)) {
    const stored = await prisma.match.findUnique({
      select: {
        eventsSyncedAt: true,
        historySyncedAt: true,
        kickoff: true,
        lineups: { select: { complete: true } },
        lineupsSyncedAt: true,
        playersSyncedAt: true,
        statisticsSyncedAt: true
      },
      where: { id: matchIds[0] }
    });
    const lineupGraceExpired = stored
      ? serverNow().getTime() - stored.kickoff.getTime() >= 8 * 60 * 60_000
      : false;
    const lineupsReady =
      coverage?.lineups === false ||
      (stored?.lineups.length === 2 && stored.lineups.every((lineup) => lineup.complete)) ||
      (lineupGraceExpired && Boolean(stored?.lineupsSyncedAt));
    const ready =
      stored &&
      lineupsReady &&
      (coverage?.events === false || Boolean(stored.eventsSyncedAt)) &&
      (coverage?.statisticsFixtures === false || Boolean(stored.statisticsSyncedAt)) &&
      (coverage?.statisticsPlayers === false || Boolean(stored.playersSyncedAt)) &&
      Boolean(stored.historySyncedAt);

    if (ready) await markFixturesFullySynced(matchIds);
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
      liveMatches: summary.liveMatches,
      nextRunAt: new Date((input.finishedAt ?? input.startedAt).getTime() + NEXT_RUN_MS),
      pendingFinalDetails: summary.pendingFinalDetails,
      pendingLineups: summary.pendingLineups,
      status,
      trackedMatches: summary.trackedMatches
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
    summary.trackedMatches = candidates.length;
    summary.liveMatches = candidates.filter((candidate) =>
      ["LIVE", "HALFTIME"].includes(candidate.status)
    ).length;
    summary.pendingLineups = candidates.filter(
      (candidate) =>
        candidate.kickoff.getTime() - now.getTime() <= 60 * 60_000 &&
        candidate.kickoff.getTime() - now.getTime() >= -2 * 60 * 60_000 &&
        !(candidate.lineups.length >= 2 && candidate.lineups.every((lineup) => lineup.complete))
    ).length;
    summary.pendingFinalDetails = candidates.filter(
      (candidate) => candidate.status === "FINISHED" && !candidate.fullySyncedAt
    ).length;

    const decisions = new Map(
      candidates.map((candidate) => [
        candidate.apiId as number,
        decisionForCandidate(candidate, usage.dailyRemaining, now, Boolean(options.matchId))
      ])
    );
    const fixtures = new Map<number, ExternalFootballFixture>();
    const fixtureLimit = Math.max(0, Math.min(options.fixtureLimit ?? MAX_CANDIDATES, 20));
    const liveCandidates = candidates.filter(
      (candidate) =>
        ["LIVE", "HALFTIME"].includes(candidate.status) &&
        decisions.get(candidate.apiId as number)?.fixture
    );

    if (fixtureLimit > 0 && liveCandidates.length > 0) {
      const liveResult = await fetchApiFootballLiveFixtures(
        activeConfigs.map((config) => config.leagueId)
      );
      summary.callsUsed += liveResult.callsUsed;
      if (liveResult.ok) liveResult.data.forEach((fixture) => fixtures.set(fixture.apiId, fixture));
      else summary.errors.push(liveResult.message);
    }

    const dueCandidates = candidates
      .filter((candidate) => {
        const decision = decisions.get(candidate.apiId as number);
        const missedLive =
          ["LIVE", "HALFTIME"].includes(candidate.status) &&
          !fixtures.has(candidate.apiId as number) &&
          (!candidate.liveSyncedAt ||
            now.getTime() - candidate.liveSyncedAt.getTime() >= 5 * 60_000);
        return (
          (decision?.fixture && !["LIVE", "HALFTIME"].includes(candidate.status)) ||
          (decision ? decisionNeedsWork(decision) : false) ||
          missedLive
        );
      });
    const dueIds = dueCandidates
      .filter((candidate) => !fixtures.has(candidate.apiId as number))
      .slice(0, fixtureLimit)
      .map((candidate) => candidate.apiId as number);

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

    for (const fixture of fixtures.values()) {
      const candidate = candidates.find((item) => item.apiId === fixture.apiId);
      if (!candidate) continue;
      const config = configForCandidate(candidate);
      if (!config) continue;

      try {
        const applied = await applyFootballFixture(config, fixture);
        if (applied.matchIds.length === 0) continue;
        const decision = decisionForCandidate(
          candidate,
          usage.dailyRemaining,
          now,
          Boolean(options.matchId)
        );
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
        summary.fixturesUpdated += applied.matchIds.length;
        summary.candidatesProcessed += 1;
        if (["FT", "AET", "PEN", "AWD", "WO"].includes(fixture.statusShort)) {
          standingsConfigs.set(config.key, config);
        }
      } catch (error) {
        summary.errors.push(
          `${fixture.apiId}: ${error instanceof Error ? error.message : "Falha ao salvar partida"}`
        );
      }
    }

    if (standingsConfigs.size > 0 && (usage.dailyRemaining === null || usage.dailyRemaining > 20)) {
      const config = standingsConfigs.values().next().value as
        FootballCompetitionConfig | undefined;
      if (config) {
        const standings = await syncFootballCompetitionStandings(config);
        summary.callsUsed += standings.callsUsed;
      }
    }

    if (trigger !== FOOTBALL_MANUAL_TRIGGER) {
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

    const finishedAt = serverNow();
    const scopeLabel = selectedConfig ? `${selectedConfig.name}: ` : "";
    const message = `${scopeLabel}${summary.catalogsSynced} campeonato(s) verificado(s); ${summary.fixturesUpdated} registro(s) de partida atualizado(s); ${summary.liveMatches} jogo(s) ao vivo; ${summary.remainingCandidates} partida(s) ainda aguardando detalhes; ${summary.callsUsed} chamada(s) externa(s).`;
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
