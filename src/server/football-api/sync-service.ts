import { Prisma, type MatchStatus, type RoundStatus } from "@prisma/client";

import { recalculateRankingsForMatch } from "@/features/ranking/services/ranking-service";
import { processMatchScores } from "@/features/scoring/services/scoring-service";
import { grantMatchResultXp } from "@/features/xp/services/xp-service";
import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import {
  fetchApiFootballFixtures,
  fetchApiFootballFixturesByIds,
  fetchApiFootballLeagues,
  fetchApiFootballRounds,
  fetchApiFootballStandings,
  fetchApiFootballTeams,
  type ExternalFootballFixture,
  type ExternalFootballTeam
} from "./client";
import { getFootballSyncCacheHours, type FootballCompetitionConfig } from "./competitions";
import { mergeFootballRoundState } from "./round-sync";
import { mapApiFootballStatus } from "./status";

type SyncCounter = {
  callsUsed: number;
  matchesImported: number;
  roundsImported: number;
  standingsImported: number;
  teamsImported: number;
};

export type FootballSyncResult =
  | {
      cached?: boolean;
      message: string;
      ok: true;
      summary: SyncCounter;
    }
  | {
      message: string;
      ok: false;
      summary: SyncCounter;
    };

export type ScoreSyncCounter = {
  callsUsed: number;
  liveMatchesUpdated: number;
  matchesHomologated: number;
  matchesUpdated: number;
  matchedFixtures: number;
  processedGuesses: number;
  rankingRows: number;
  unmatchedFixtures: number;
  xpEvents: number;
};

export type FootballScoreSyncResult =
  | {
      message: string;
      ok: true;
      summary: ScoreSyncCounter;
    }
  | {
      message: string;
      ok: false;
      summary: ScoreSyncCounter;
    };

const PROVIDER = "api-football";
const SCORE_SYNC_SUFFIX = ":scores";
const SCORE_MATCH_WINDOW_HOURS = 12;

const matchScoreSyncSelect = Prisma.validator<Prisma.MatchSelect>()({
  _count: {
    select: {
      guesses: true
    }
  },
  awayScore: true,
  deletedAt: true,
  homeScore: true,
  homologatedAt: true,
  id: true,
  guesses: {
    select: {
      id: true
    },
    take: 1,
    where: {
      deletedAt: null,
      score: null
    }
  },
  kickoff: true,
  lastSyncedAt: true,
  status: true
});

type MatchForScoreSync = Prisma.MatchGetPayload<{
  select: typeof matchScoreSyncSelect;
}>;

function emptySummary(): SyncCounter {
  return {
    callsUsed: 0,
    matchesImported: 0,
    roundsImported: 0,
    standingsImported: 0,
    teamsImported: 0
  };
}

function emptyScoreSummary(): ScoreSyncCounter {
  return {
    callsUsed: 0,
    liveMatchesUpdated: 0,
    matchesHomologated: 0,
    matchesUpdated: 0,
    matchedFixtures: 0,
    processedGuesses: 0,
    rankingRows: 0,
    unmatchedFixtures: 0,
    xpEvents: 0
  };
}

function addCalls(summary: SyncCounter, callsUsed: number) {
  summary.callsUsed += callsUsed;
}

function toChampionshipStatus(): "ACTIVE" {
  return "ACTIVE";
}

function getRoundStatus(statuses: MatchStatus[]): RoundStatus {
  if (statuses.some((status) => status === "LIVE" || status === "HALFTIME")) {
    return "LIVE";
  }

  if (
    statuses.length > 0 &&
    statuses.every((status) => status === "FINISHED" || status === "CANCELLED")
  ) {
    return "FINISHED";
  }

  return "SCHEDULED";
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function getScoreSyncKey(config: FootballCompetitionConfig) {
  return `${config.key}${SCORE_SYNC_SUFFIX}`;
}

async function getFreshSuccessfulSync(config: FootballCompetitionConfig) {
  const cacheHours = getFootballSyncCacheHours();

  if (cacheHours <= 0) {
    return null;
  }

  const minFinishedAt = new Date(serverNow().getTime() - cacheHours * 60 * 60 * 1000);

  return prisma.footballSyncLog.findFirst({
    orderBy: {
      finishedAt: "desc"
    },
    where: {
      competitionKey: config.key,
      finishedAt: {
        gte: minFinishedAt
      },
      season: config.season,
      status: "SUCCESS"
    }
  });
}

async function logSync(
  config: FootballCompetitionConfig,
  status: "SUCCESS" | "FAILED" | "SKIPPED",
  message: string,
  summary: SyncCounter,
  startedAt: Date
) {
  await prisma.footballSyncLog.create({
    data: {
      callsUsed: summary.callsUsed,
      competitionKey: config.key,
      finishedAt: serverNow(),
      leagueId: config.leagueId,
      matchesImported: summary.matchesImported,
      message,
      roundsImported: summary.roundsImported,
      season: config.season,
      standingsImported: summary.standingsImported,
      startedAt,
      status,
      teamsImported: summary.teamsImported
    }
  });
}

async function logScoreSync(
  config: FootballCompetitionConfig,
  status: "SUCCESS" | "FAILED",
  message: string,
  summary: ScoreSyncCounter,
  startedAt: Date
) {
  await prisma.footballSyncLog.create({
    data: {
      callsUsed: summary.callsUsed,
      competitionKey: getScoreSyncKey(config),
      finishedAt: serverNow(),
      leagueId: config.leagueId,
      matchesImported: summary.matchesUpdated,
      message,
      roundsImported: summary.matchesHomologated,
      season: config.season,
      standingsImported: 0,
      startedAt,
      status,
      teamsImported: 0
    }
  });
}

export async function upsertFootballTeam(team: ExternalFootballTeam) {
  const existingByApiId = await prisma.team.findUnique({
    select: {
      id: true
    },
    where: {
      apiId: team.apiId
    }
  });

  if (existingByApiId) {
    return prisma.team.update({
      data: {
        country: team.country,
        logo: team.logo ?? undefined,
        name: team.name,
        shortName: team.shortName ?? undefined
      },
      where: {
        id: existingByApiId.id
      }
    });
  }

  const existingByName = await prisma.team.findFirst({
    select: {
      id: true
    },
    where: {
      apiId: null,
      country: {
        equals: team.country,
        mode: "insensitive"
      },
      name: {
        equals: team.name,
        mode: "insensitive"
      }
    }
  });

  if (existingByName) {
    return prisma.team.update({
      data: {
        apiId: team.apiId,
        country: team.country,
        logo: team.logo ?? undefined,
        name: team.name,
        shortName: team.shortName ?? undefined
      },
      where: {
        id: existingByName.id
      }
    });
  }

  return prisma.team.upsert({
    create: {
      apiId: team.apiId,
      country: team.country,
      logo: team.logo,
      name: team.name,
      shortName: team.shortName
    },
    update: {
      country: team.country,
      logo: team.logo ?? undefined,
      name: team.name,
      shortName: team.shortName ?? undefined
    },
    where: {
      apiId: team.apiId
    }
  });
}

async function upsertCompetition(config: FootballCompetitionConfig, summary: SyncCounter) {
  const leagueResult = await fetchApiFootballLeagues({
    id: config.leagueId,
    season: config.season
  });
  addCalls(summary, leagueResult.callsUsed);

  if (!leagueResult.ok) {
    throw new Error(leagueResult.message);
  }

  const league = leagueResult.data[0];

  if (!league) {
    throw new Error(`Competicao ${config.name} nao encontrada na API-Football.`);
  }

  const championship = await prisma.championship.upsert({
    create: {
      apiId: config.leagueId,
      country: config.countryOrContinent,
      description: `${league.name} importado da API-Football.`,
      coverage: league.coverage ?? undefined,
      coverageSyncedAt: league.coverage ? serverNow() : undefined,
      logo: league.logo,
      name: league.name || config.name,
      provider: PROVIDER,
      status: toChampionshipStatus()
    },
    update: {
      country: config.countryOrContinent,
      description: `${league.name} importado da API-Football.`,
      coverage: league.coverage ?? undefined,
      coverageSyncedAt: league.coverage ? serverNow() : undefined,
      logo: league.logo,
      name: league.name || config.name,
      status: toChampionshipStatus()
    },
    where: {
      provider_apiId: {
        apiId: config.leagueId,
        provider: PROVIDER
      }
    }
  });

  const season = await prisma.season.upsert({
    create: {
      championshipId: championship.id,
      name: String(config.season),
      coverage: league.coverage ?? undefined,
      coverageSyncedAt: league.coverage ? serverNow() : undefined,
      status: "ACTIVE",
      year: config.season
    },
    update: {
      name: String(config.season),
      coverage: league.coverage ?? undefined,
      coverageSyncedAt: league.coverage ? serverNow() : undefined,
      status: "ACTIVE"
    },
    where: {
      championshipId_year: {
        championshipId: championship.id,
        year: config.season
      }
    }
  });

  return {
    championship,
    season
  };
}

async function upsertTeams(config: FootballCompetitionConfig, summary: SyncCounter) {
  const teamsResult = await fetchApiFootballTeams({
    leagueId: config.leagueId,
    season: config.season
  });
  addCalls(summary, teamsResult.callsUsed);

  if (!teamsResult.ok) {
    throw new Error(teamsResult.message);
  }

  for (const teamBatch of chunkValues(teamsResult.teams, 20)) {
    await Promise.all(teamBatch.map((team) => upsertFootballTeam(team)));
  }
  summary.teamsImported += teamsResult.teams.length;
}

async function upsertFixtures(
  config: FootballCompetitionConfig,
  seasonId: string,
  summary: SyncCounter
) {
  const roundsResult = await fetchApiFootballRounds(config.leagueId, config.season);
  addCalls(summary, roundsResult.callsUsed);

  if (!roundsResult.ok) {
    throw new Error(roundsResult.message);
  }

  const orderMap = new Map<string, number>();
  roundsResult.data.forEach((roundName, index) => {
    orderMap.set(roundName, index + 1);
  });

  const fixturesResult = await fetchApiFootballFixtures(config.leagueId, config.season);
  addCalls(summary, fixturesResult.callsUsed);

  if (!fixturesResult.ok) {
    throw new Error(fixturesResult.message);
  }

  const fixtureTeams = new Map<number, ExternalFootballTeam>();
  for (const fixture of fixturesResult.data) {
    fixtureTeams.set(fixture.homeTeam.apiId, fixture.homeTeam);
    fixtureTeams.set(fixture.awayTeam.apiId, fixture.awayTeam);
  }

  const teamIds = new Map<number, string>();
  for (const teamBatch of chunkValues(Array.from(fixtureTeams.values()), 20)) {
    const storedTeams = await Promise.all(teamBatch.map((team) => upsertFootballTeam(team)));
    storedTeams.forEach((team) => {
      if (team.apiId !== null) teamIds.set(team.apiId, team.id);
    });
  }

  const existingRounds = await prisma.round.findMany({
    select: {
      endsAt: true,
      id: true,
      name: true,
      number: true,
      startsAt: true,
      status: true
    },
    where: {
      leagueId: null,
      seasonId
    }
  });
  const roundsByName = new Map(
    existingRounds
      .filter((round) => Boolean(round.name))
      .map((round) => [round.name as string, round])
  );
  const firstKickoffByRound = new Map<string, Date>();
  for (const fixture of fixturesResult.data) {
    const current = firstKickoffByRound.get(fixture.round);
    if (!current || fixture.kickoff < current) {
      firstKickoffByRound.set(fixture.round, fixture.kickoff);
    }
  }

  let nextRoundNumber =
    Math.max(roundsResult.data.length, ...existingRounds.map((round) => round.number), 0) + 1;
  for (const [roundName, kickoff] of firstKickoffByRound.entries()) {
    if (roundsByName.has(roundName)) continue;

    const mappedNumber = orderMap.get(roundName) ?? nextRoundNumber++;
    const round = await prisma.round.create({
      data: {
        endsAt: addHours(kickoff, 2),
        leagueId: null,
        name: roundName,
        number: mappedNumber,
        seasonId,
        startsAt: kickoff,
        status: "SCHEDULED"
      },
      select: {
        endsAt: true,
        id: true,
        name: true,
        number: true,
        startsAt: true,
        status: true
      }
    });
    roundsByName.set(roundName, round);
  }

  const existingMatches = await prisma.match.findMany({
    select: {
      apiId: true,
      id: true
    },
    where: {
      apiId: {
        in: fixturesResult.data.map((fixture) => fixture.apiId)
      }
    }
  });
  const matchesByApiId = new Map(
    existingMatches
      .filter((match) => match.apiId !== null)
      .map((match) => [match.apiId as number, match.id])
  );

  const roundBounds = new Map<
    string,
    {
      end: Date;
      start: Date;
      statuses: MatchStatus[];
    }
  >();

  for (const fixtureBatch of chunkValues(fixturesResult.data, 20)) {
    await Promise.all(
      fixtureBatch.map(async (fixture) => {
        const homeTeamId = teamIds.get(fixture.homeTeam.apiId);
        const awayTeamId = teamIds.get(fixture.awayTeam.apiId);
        const round = roundsByName.get(fixture.round);

        if (!homeTeamId || !awayTeamId || !round) {
          throw new Error(`Dados locais incompletos para a partida ${fixture.apiId}.`);
        }

        const status = mapApiFootballStatus(fixture.statusShort);
        const matchData: Prisma.MatchUncheckedCreateInput = {
          apiId: fixture.apiId,
          apiStatus: fixture.statusShort,
          awayScore: fixture.awayScore,
          awayTeamId,
          city: fixture.city,
          country: fixture.country,
          homeScore: fixture.homeScore,
          homeTeamId,
          halftimeAway: fixture.halftime.away,
          halftimeHome: fixture.halftime.home,
          kickoff: fixture.kickoff,
          elapsed: fixture.elapsed,
          extraTime: fixture.extra,
          extraTimeAway: fixture.extraTime.away,
          extraTimeHome: fixture.extraTime.home,
          lastSyncedAt: serverNow(),
          penaltyAway: fixture.penalty.away,
          penaltyHome: fixture.penalty.home,
          referee: fixture.referee,
          roundId: round.id,
          stadium: fixture.stadium,
          status,
          statusLong: fixture.statusLong,
          secondHalfAway: fixture.secondHalf.away,
          secondHalfHome: fixture.secondHalf.home
        };
        const existingMatchId = matchesByApiId.get(fixture.apiId);

        if (existingMatchId) {
          await prisma.match.update({
            data: {
              ...matchData,
              deletedAt: null
            },
            where: {
              id: existingMatchId
            }
          });
        } else {
          const created = await prisma.match.create({
            data: matchData,
            select: { id: true }
          });
          matchesByApiId.set(fixture.apiId, created.id);
        }

        const currentBounds = roundBounds.get(round.id);
        const fixtureEnd = addHours(fixture.kickoff, 2);
        roundBounds.set(round.id, {
          end: currentBounds && currentBounds.end > fixtureEnd ? currentBounds.end : fixtureEnd,
          start:
            currentBounds && currentBounds.start < fixture.kickoff
              ? currentBounds.start
              : fixture.kickoff,
          statuses: [...(currentBounds?.statuses ?? []), status]
        });
      })
    );
  }

  summary.matchesImported += fixturesResult.data.length;
  const roundsById = new Map(Array.from(roundsByName.values()).map((round) => [round.id, round]));

  for (const roundBatch of chunkValues(Array.from(roundBounds.entries()), 20)) {
    await Promise.all(
      roundBatch.map(([roundId, bounds]) => {
        const currentRound = roundsById.get(roundId);
        const incomingState = {
          endsAt: bounds.end,
          startsAt: bounds.start,
          status: getRoundStatus(bounds.statuses)
        };
        const nextState = currentRound
          ? mergeFootballRoundState(currentRound, incomingState)
          : incomingState;

        return prisma.round.update({
          data: {
            endsAt: nextState.endsAt,
            startsAt: nextState.startsAt,
            status: nextState.status
          },
          where: {
            id: roundId
          }
        });
      })
    );
  }
  summary.roundsImported += roundBounds.size;
}

async function upsertStandings(
  config: FootballCompetitionConfig,
  seasonId: string,
  summary: SyncCounter
) {
  const standingsResult = await fetchApiFootballStandings(config.leagueId, config.season);
  addCalls(summary, standingsResult.callsUsed);

  if (!standingsResult.ok) {
    return;
  }

  for (const standingsBatch of chunkValues(standingsResult.data, 20)) {
    await Promise.all(
      standingsBatch.map(async (row) => {
        const team = await upsertFootballTeam(row.team);

        await prisma.competitionStanding.upsert({
          create: {
            description: row.description,
            draws: row.draws,
            form: row.form,
            goalDiff: row.goalDiff,
            goalsAgainst: row.goalsAgainst,
            goalsFor: row.goalsFor,
            groupName: row.groupName,
            losses: row.losses,
            played: row.played,
            points: row.points,
            rank: row.rank,
            seasonId,
            status: row.status,
            teamId: team.id,
            wins: row.wins
          },
          update: {
            description: row.description,
            draws: row.draws,
            form: row.form,
            goalDiff: row.goalDiff,
            goalsAgainst: row.goalsAgainst,
            goalsFor: row.goalsFor,
            losses: row.losses,
            played: row.played,
            points: row.points,
            rank: row.rank,
            status: row.status,
            wins: row.wins
          },
          where: {
            seasonId_teamId_groupName: {
              groupName: row.groupName,
              seasonId,
              teamId: team.id
            }
          }
        });
      })
    );
  }
  summary.standingsImported += standingsResult.data.length;
}

export async function syncFootballCompetitionStandings(config: FootballCompetitionConfig) {
  const summary = emptySummary();
  const season = await prisma.season.findFirst({
    select: {
      id: true
    },
    where: {
      championship: {
        apiId: config.leagueId,
        provider: PROVIDER
      },
      year: config.season
    }
  });

  if (!season) {
    return { callsUsed: 0, rows: 0 };
  }

  await upsertStandings(config, season.id, summary);
  return {
    callsUsed: summary.callsUsed,
    rows: summary.standingsImported
  };
}

async function findTeamIdsForFixtureTeam(team: ExternalFootballTeam, fallbackId: string) {
  const matches = await prisma.team.findMany({
    select: {
      id: true
    },
    where: {
      OR: [
        {
          id: fallbackId
        },
        {
          apiId: team.apiId
        },
        {
          name: {
            equals: team.name,
            mode: "insensitive"
          }
        }
      ]
    }
  });

  return Array.from(new Set(matches.map((match) => match.id)));
}

async function findMatchesForFixture(
  config: FootballCompetitionConfig,
  fixture: ExternalFootballFixture
) {
  const [homeTeam, awayTeam] = await Promise.all([
    upsertFootballTeam(fixture.homeTeam),
    upsertFootballTeam(fixture.awayTeam)
  ]);
  const [homeTeamIds, awayTeamIds] = await Promise.all([
    findTeamIdsForFixtureTeam(fixture.homeTeam, homeTeam.id),
    findTeamIdsForFixtureTeam(fixture.awayTeam, awayTeam.id)
  ]);
  const kickoffStart = addHours(fixture.kickoff, -SCORE_MATCH_WINDOW_HOURS);
  const kickoffEnd = addHours(fixture.kickoff, SCORE_MATCH_WINDOW_HOURS);
  const [apiMatches, candidateMatches] = await Promise.all([
    prisma.match.findMany({
      select: matchScoreSyncSelect,
      where: {
        apiId: fixture.apiId,
        deletedAt: null
      }
    }),
    prisma.match.findMany({
      select: matchScoreSyncSelect,
      where: {
        awayTeamId: {
          in: awayTeamIds
        },
        deletedAt: null,
        homeTeamId: {
          in: homeTeamIds
        },
        kickoff: {
          gte: kickoffStart,
          lte: kickoffEnd
        },
        round: {
          season: {
            championship: {
              apiId: config.leagueId,
              provider: PROVIDER
            },
            year: config.season
          }
        }
      }
    })
  ]);
  const matchesById = new Map<string, MatchForScoreSync>();

  [...apiMatches, ...candidateMatches].forEach((match) => {
    matchesById.set(match.id, match);
  });

  return Array.from(matchesById.values());
}

function getFixtureScores(fixture: ExternalFootballFixture) {
  const homeScore = typeof fixture.homeScore === "number" ? fixture.homeScore : null;
  const awayScore = typeof fixture.awayScore === "number" ? fixture.awayScore : null;

  return {
    awayScore,
    hasScore: homeScore !== null && awayScore !== null,
    homeScore
  };
}

export function shouldProcessFixtureScores(input: {
  guessCount: number;
  hasMissingScore: boolean;
  needsHomologation: boolean;
  shouldHomologate: boolean;
}) {
  return (
    input.shouldHomologate &&
    input.guessCount > 0 &&
    (input.needsHomologation || input.hasMissingScore)
  );
}

async function updateMatchFromFixture(
  match: MatchForScoreSync,
  fixture: ExternalFootballFixture,
  status: MatchStatus,
  summary: ScoreSyncCounter
) {
  const { awayScore, hasScore, homeScore } = getFixtureScores(fixture);
  const scoreChanged = hasScore && (match.homeScore !== homeScore || match.awayScore !== awayScore);
  const statusChanged = match.status !== status;
  const shouldHomologate = status === "FINISHED" && hasScore;
  const needsHomologation = shouldHomologate && (!match.homologatedAt || scoreChanged);
  const needsScoreProcessing = shouldProcessFixtureScores({
    guessCount: match._count.guesses,
    hasMissingScore: match.guesses.length > 0,
    needsHomologation,
    shouldHomologate
  });
  const updateData: Prisma.MatchUpdateInput = {
    apiStatus: fixture.statusShort,
    city: fixture.city,
    elapsed: fixture.elapsed,
    extraTime: fixture.extra,
    extraTimeAway: fixture.extraTime.away,
    extraTimeHome: fixture.extraTime.home,
    halftimeAway: fixture.halftime.away,
    halftimeHome: fixture.halftime.home,
    kickoff: fixture.kickoff,
    lastSyncedAt: serverNow(),
    penaltyAway: fixture.penalty.away,
    penaltyHome: fixture.penalty.home,
    referee: fixture.referee,
    secondHalfAway: fixture.secondHalf.away,
    secondHalfHome: fixture.secondHalf.home,
    stadium: fixture.stadium,
    status,
    statusLong: fixture.statusLong,
    ...(status === "LIVE" || status === "HALFTIME" ? { liveSyncedAt: serverNow() } : {})
  };

  if (hasScore) {
    updateData.awayScore = awayScore;
    updateData.homeScore = homeScore;
  }

  if (needsHomologation) {
    updateData.homologatedAt = serverNow();
  }

  await prisma.match.update({
    data: updateData,
    where: {
      id: match.id
    }
  });

  if (scoreChanged || statusChanged || needsHomologation) {
    summary.matchesUpdated += 1;

    if (status === "LIVE" || status === "HALFTIME") {
      summary.liveMatchesUpdated += 1;
    }

    if (needsHomologation) {
      summary.matchesHomologated += 1;
    }
  }

  if (!needsScoreProcessing) {
    return;
  }

  const scoringSummary = await processMatchScores(match.id);
  const xpSummary = await grantMatchResultXp(match.id);
  const rankingSummary = await recalculateRankingsForMatch(match.id);

  summary.processedGuesses += scoringSummary.processedGuesses;
  summary.rankingRows += rankingSummary.leagueRows;
  summary.xpEvents += xpSummary.resultHitEvents + xpSummary.exactScoreEvents;
}

async function backfillMissingCompetitionScores(
  config: FootballCompetitionConfig,
  summary: ScoreSyncCounter
) {
  const matches = await prisma.match.findMany({
    orderBy: {
      kickoff: "asc"
    },
    select: {
      id: true
    },
    take: 100,
    where: {
      awayScore: {
        not: null
      },
      deletedAt: null,
      guesses: {
        some: {
          deletedAt: null,
          score: null
        }
      },
      homeScore: {
        not: null
      },
      homologatedAt: {
        not: null
      },
      round: {
        leagueId: {
          not: null
        },
        season: {
          championship: {
            apiId: config.leagueId,
            provider: PROVIDER
          },
          year: config.season
        }
      },
      status: "FINISHED"
    }
  });

  for (const match of matches) {
    const scoringSummary = await processMatchScores(match.id);
    const xpSummary = await grantMatchResultXp(match.id);
    const rankingSummary = await recalculateRankingsForMatch(match.id);

    summary.processedGuesses += scoringSummary.processedGuesses;
    summary.rankingRows += rankingSummary.leagueRows;
    summary.xpEvents += xpSummary.resultHitEvents + xpSummary.exactScoreEvents;
  }
}

export async function applyFootballFixture(
  config: FootballCompetitionConfig,
  fixture: ExternalFootballFixture
) {
  const summary = emptyScoreSummary();
  const matches = await findMatchesForFixture(config, fixture);
  const status = mapApiFootballStatus(fixture.statusShort);

  for (const match of matches) {
    await updateMatchFromFixture(match, fixture, status, summary);
  }

  return {
    matchIds: matches.map((match) => match.id),
    status,
    summary
  };
}

export async function syncFootballCompetitionScores(
  config: FootballCompetitionConfig
): Promise<FootballScoreSyncResult> {
  const startedAt = serverNow();
  const summary = emptyScoreSummary();

  try {
    const now = serverNow();
    await backfillMissingCompetitionScores(config, summary);
    const localCandidates = await prisma.match.findMany({
      orderBy: {
        kickoff: "asc"
      },
      select: {
        apiId: true
      },
      take: 100,
      where: {
        apiId: {
          not: null
        },
        deletedAt: null,
        round: {
          leagueId: null,
          season: {
            championship: {
              apiId: config.leagueId,
              provider: PROVIDER
            },
            year: config.season
          }
        },
        OR: [
          {
            status: {
              in: ["LIVE", "HALFTIME", "SUSPENDED"]
            }
          },
          {
            kickoff: {
              gte: addHours(now, -36),
              lte: addHours(now, 12)
            }
          },
          {
            homologatedAt: null,
            kickoff: {
              lte: now
            },
            status: {
              not: "CANCELLED"
            }
          }
        ]
      }
    });
    const fixtureIds = Array.from(
      new Set(
        localCandidates
          .map((match) => match.apiId)
          .filter((apiId): apiId is number => apiId !== null)
      )
    );

    if (fixtureIds.length === 0) {
      const message = `${config.name}: nenhuma partida local precisa de atualizacao de placar agora.`;
      await logScoreSync(config, "SUCCESS", message, summary, startedAt);
      return {
        message,
        ok: true,
        summary
      };
    }

    for (const fixtureBatch of chunkValues(fixtureIds, 20)) {
      const fixturesResult = await fetchApiFootballFixturesByIds(fixtureBatch, "CRITICAL");
      summary.callsUsed += fixturesResult.callsUsed;

      if (!fixturesResult.ok) {
        throw new Error(fixturesResult.message);
      }

      for (const fixture of fixturesResult.data) {
        const applied = await applyFootballFixture(config, fixture);

        if (applied.matchIds.length === 0) {
          summary.unmatchedFixtures += 1;
          continue;
        }

        summary.matchedFixtures += 1;
        summary.liveMatchesUpdated += applied.summary.liveMatchesUpdated;
        summary.matchesHomologated += applied.summary.matchesHomologated;
        summary.matchesUpdated += applied.summary.matchesUpdated;
        summary.processedGuesses += applied.summary.processedGuesses;
        summary.rankingRows += applied.summary.rankingRows;
        summary.xpEvents += applied.summary.xpEvents;
      }
    }

    const message = `${config.name}: ${summary.matchesUpdated} partida(s) atualizada(s), ${summary.matchesHomologated} finalizada(s), ${summary.processedGuesses} palpite(s) processado(s). ${summary.unmatchedFixtures} jogo(s) da API sem partida local correspondente.`;
    await logScoreSync(config, "SUCCESS", message, summary, startedAt);

    return {
      message,
      ok: true,
      summary
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado ao atualizar placares.";
    await logScoreSync(config, "FAILED", message, summary, startedAt);

    return {
      message,
      ok: false,
      summary
    };
  }
}

export async function syncFootballCompetition(
  config: FootballCompetitionConfig,
  options: {
    force?: boolean;
  } = {}
): Promise<FootballSyncResult> {
  const startedAt = serverNow();
  const summary = emptySummary();

  if (!options.force) {
    const freshSync = await getFreshSuccessfulSync(config);

    if (freshSync) {
      const message = `Sincronizacao ignorada: ${config.name} ja foi atualizado nas ultimas ${getFootballSyncCacheHours()} horas.`;
      await logSync(config, "SKIPPED", message, summary, startedAt);

      return {
        cached: true,
        message,
        ok: true,
        summary
      };
    }
  }

  try {
    const { season } = await upsertCompetition(config, summary);
    await upsertTeams(config, summary);
    await upsertFixtures(config, season.id, summary);
    await upsertStandings(config, season.id, summary);

    const message = `${config.name} sincronizado: ${summary.teamsImported} times, ${summary.roundsImported} fases/rodadas, ${summary.matchesImported} jogos e ${summary.standingsImported} linhas de classificacao.`;
    await logSync(config, "SUCCESS", message, summary, startedAt);

    return {
      message,
      ok: true,
      summary
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado na sincronizacao.";
    await logSync(config, "FAILED", message, summary, startedAt);

    return {
      message,
      ok: false,
      summary
    };
  }
}
