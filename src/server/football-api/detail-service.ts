import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";

import { upsertFootballTeam } from "./sync-service";
import type {
  ExternalFootballEvent,
  ExternalFootballFixture,
  ExternalFootballLineup,
  ExternalFootballPlayer,
  ExternalFootballPlayerStatistic,
  ExternalFootballStatistic,
  ExternalFootballVenue,
  ExternalTeamSeasonStatistics
} from "./types";

type InsightInput = {
  awayRecent: ExternalFootballFixture[];
  awaySeasonStats?: ExternalTeamSeasonStatistics | null;
  headToHead: ExternalFootballFixture[];
  homeRecent: ExternalFootballFixture[];
  homeSeasonStats?: ExternalTeamSeasonStatistics | null;
};

function asJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function eventKey(matchId: string, event: ExternalFootballEvent) {
  const identity = JSON.stringify({
    assist: event.assist?.apiId ?? null,
    detail: event.detail ?? null,
    elapsed: event.elapsed,
    extra: event.extra ?? null,
    matchId,
    player: event.player?.apiId ?? null,
    team: event.team?.apiId ?? null,
    type: event.type
  });

  return `event:${createHash("sha256").update(identity).digest("hex")}`;
}

export async function upsertFootballPlayer(player: ExternalFootballPlayer) {
  return prisma.footballPlayer.upsert({
    create: {
      externalId: player.apiId,
      firstName: player.firstName,
      lastName: player.lastName,
      name: player.name,
      photoUrl: player.photo,
      position: player.position
    },
    update: {
      firstName: player.firstName ?? undefined,
      lastName: player.lastName ?? undefined,
      name: player.name,
      photoUrl: player.photo ?? undefined,
      position: player.position ?? undefined
    },
    where: {
      externalId: player.apiId
    }
  });
}

export async function saveFixtureVenue(matchIds: string[], venue: ExternalFootballVenue) {
  const storedVenue = await prisma.footballVenue.upsert({
    create: {
      address: venue.address,
      capacity: venue.capacity,
      city: venue.city,
      country: venue.country,
      externalId: venue.apiId,
      imageUrl: venue.image,
      name: venue.name,
      surface: venue.surface
    },
    update: {
      address: venue.address ?? undefined,
      capacity: venue.capacity ?? undefined,
      city: venue.city ?? undefined,
      country: venue.country ?? undefined,
      imageUrl: venue.image ?? undefined,
      name: venue.name,
      surface: venue.surface ?? undefined
    },
    where: {
      externalId: venue.apiId
    }
  });

  await prisma.match.updateMany({
    data: {
      city: venue.city ?? undefined,
      footballVenueId: storedVenue.id,
      stadium: venue.name
    },
    where: {
      id: {
        in: matchIds
      }
    }
  });
}

export async function saveFixtureLineups(matchIds: string[], lineups: ExternalFootballLineup[]) {
  const syncedAt = serverNow();
  let complete = lineups.length >= 2;

  for (const matchId of matchIds) {
    for (const externalLineup of lineups) {
      const team = await upsertFootballTeam(externalLineup.team);
      const players = [
        ...externalLineup.starters.map((entry, index) => ({
          ...entry,
          role: "STARTER" as const,
          sortOrder: index
        })),
        ...externalLineup.substitutes.map((entry, index) => ({
          ...entry,
          role: "SUBSTITUTE" as const,
          sortOrder: index
        }))
      ];
      const lineupComplete = externalLineup.starters.length >= 11;
      complete = complete && lineupComplete;
      const lineup = await prisma.matchLineup.upsert({
        create: {
          coachExternalId: externalLineup.coach.apiId,
          coachName: externalLineup.coach.name,
          coachPhotoUrl: externalLineup.coach.photo,
          complete: lineupComplete,
          formation: externalLineup.formation,
          matchId,
          teamId: team.id
        },
        update: {
          coachExternalId: externalLineup.coach.apiId ?? undefined,
          coachName: externalLineup.coach.name ?? undefined,
          coachPhotoUrl: externalLineup.coach.photo ?? undefined,
          complete: lineupComplete,
          formation: externalLineup.formation ?? undefined
        },
        where: {
          matchId_teamId: {
            matchId,
            teamId: team.id
          }
        }
      });
      const storedPlayerIds: string[] = [];

      for (const entry of players) {
        const player = await upsertFootballPlayer({
          ...entry.player,
          position: entry.position || entry.player.position
        });
        storedPlayerIds.push(player.id);
        await prisma.matchLineupPlayer.upsert({
          create: {
            grid: entry.grid,
            lineupId: lineup.id,
            playerId: player.id,
            position: entry.position,
            role: entry.role,
            shirtNumber: entry.number,
            sortOrder: entry.sortOrder
          },
          update: {
            grid: entry.grid,
            position: entry.position,
            role: entry.role,
            shirtNumber: entry.number,
            sortOrder: entry.sortOrder
          },
          where: {
            lineupId_playerId: {
              lineupId: lineup.id,
              playerId: player.id
            }
          }
        });
      }

      if (storedPlayerIds.length > 0) {
        await prisma.matchLineupPlayer.deleteMany({
          where: {
            lineupId: lineup.id,
            playerId: {
              notIn: storedPlayerIds
            }
          }
        });
      }
    }
  }

  await prisma.match.updateMany({
    data: {
      lineupsSyncedAt: syncedAt
    },
    where: {
      id: {
        in: matchIds
      }
    }
  });

  return { complete };
}

export async function saveFixtureEvents(matchIds: string[], events: ExternalFootballEvent[]) {
  const syncedAt = serverNow();

  for (const matchId of matchIds) {
    for (const event of events) {
      const [team, player, assist] = await Promise.all([
        event.team ? upsertFootballTeam(event.team) : null,
        event.player ? upsertFootballPlayer(event.player) : null,
        event.assist ? upsertFootballPlayer(event.assist) : null
      ]);
      const externalKey = eventKey(matchId, event);

      await prisma.matchEvent.upsert({
        create: {
          assistPlayerId: assist?.id,
          comments: event.comments,
          detail: event.detail,
          elapsed: event.elapsed,
          externalKey,
          extra: event.extra,
          matchId,
          playerId: player?.id,
          teamId: team?.id,
          type: event.type
        },
        update: {
          assistPlayerId: assist?.id,
          comments: event.comments,
          detail: event.detail,
          elapsed: event.elapsed,
          extra: event.extra,
          playerId: player?.id,
          teamId: team?.id,
          type: event.type
        },
        where: {
          externalKey
        }
      });
    }
  }

  await prisma.match.updateMany({
    data: {
      eventsSyncedAt: syncedAt
    },
    where: {
      id: {
        in: matchIds
      }
    }
  });
}

export async function saveFixtureStatistics(
  matchIds: string[],
  statistics: ExternalFootballStatistic[]
) {
  const syncedAt = serverNow();

  for (const matchId of matchIds) {
    for (const teamStatistics of statistics) {
      const team = await upsertFootballTeam(teamStatistics.team);

      for (const statistic of teamStatistics.values) {
        await prisma.matchStatistic.upsert({
          create: {
            matchId,
            teamId: team.id,
            type: statistic.type,
            value: statistic.value === null ? null : String(statistic.value)
          },
          update: {
            value: statistic.value === null ? null : String(statistic.value)
          },
          where: {
            matchId_teamId_period_type: {
              matchId,
              period: "FULL_TIME",
              teamId: team.id,
              type: statistic.type
            }
          }
        });
      }
    }
  }

  await prisma.match.updateMany({
    data: {
      statisticsSyncedAt: syncedAt
    },
    where: {
      id: {
        in: matchIds
      }
    }
  });
}

export async function saveFixturePlayerStatistics(
  matchIds: string[],
  rows: ExternalFootballPlayerStatistic[]
) {
  const syncedAt = serverNow();

  for (const matchId of matchIds) {
    for (const row of rows) {
      const [team, player] = await Promise.all([
        upsertFootballTeam(row.team),
        upsertFootballPlayer(row.player)
      ]);

      await prisma.matchPlayerStatistic.upsert({
        create: {
          matchId,
          playerId: player.id,
          statistics: asJson(row.statistics),
          teamId: team.id
        },
        update: {
          statistics: asJson(row.statistics)
        },
        where: {
          matchId_teamId_playerId: {
            matchId,
            playerId: player.id,
            teamId: team.id
          }
        }
      });
    }
  }

  await prisma.match.updateMany({
    data: {
      playersSyncedAt: syncedAt
    },
    where: {
      id: {
        in: matchIds
      }
    }
  });
}

function serializeFixture(fixture: ExternalFootballFixture) {
  return {
    apiId: fixture.apiId,
    awayScore: fixture.awayScore ?? null,
    awayTeam: fixture.awayTeam,
    homeScore: fixture.homeScore ?? null,
    homeTeam: fixture.homeTeam,
    kickoff: fixture.kickoff.toISOString(),
    status: fixture.statusShort
  };
}

function summarizeRecent(teamApiId: number, fixtures: ExternalFootballFixture[]) {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let homeWins = 0;
  let awayWins = 0;

  for (const fixture of fixtures) {
    const isHome = fixture.homeTeam.apiId === teamApiId;
    const own = isHome ? fixture.homeScore : fixture.awayScore;
    const opponent = isHome ? fixture.awayScore : fixture.homeScore;
    if (typeof own !== "number" || typeof opponent !== "number") continue;
    goalsFor += own;
    goalsAgainst += opponent;
    if (own > opponent) {
      wins += 1;
      if (isHome) homeWins += 1;
      else awayWins += 1;
    } else if (own === opponent) {
      draws += 1;
    } else {
      losses += 1;
    }
  }

  return {
    awayWins,
    draws,
    fixtures: fixtures.map(serializeFixture),
    goalsAgainst,
    goalsFor,
    homeWins,
    losses,
    sequence: fixtures
      .map((fixture) => {
        const isHome = fixture.homeTeam.apiId === teamApiId;
        const own = isHome ? fixture.homeScore : fixture.awayScore;
        const opponent = isHome ? fixture.awayScore : fixture.homeScore;
        if (typeof own !== "number" || typeof opponent !== "number") return "-";
        return own > opponent ? "V" : own === opponent ? "E" : "D";
      })
      .join(""),
    wins
  };
}

function summarizeHeadToHead(fixtures: ExternalFootballFixture[]) {
  const totalGoals = fixtures.reduce(
    (total, fixture) => total + (fixture.homeScore ?? 0) + (fixture.awayScore ?? 0),
    0
  );
  return {
    averageGoals: fixtures.length > 0 ? Number((totalGoals / fixtures.length).toFixed(2)) : 0,
    fixtures: fixtures.map(serializeFixture),
    games: fixtures.length
  };
}

export async function saveFixtureInsights(
  matchIds: string[],
  homeTeamApiId: number,
  awayTeamApiId: number,
  insight: InsightInput
) {
  const syncedAt = serverNow();

  for (const matchId of matchIds) {
    await prisma.matchInsight.upsert({
      create: {
        awayRecent: asJson(summarizeRecent(awayTeamApiId, insight.awayRecent)),
        awaySeasonStats: insight.awaySeasonStats ? asJson(insight.awaySeasonStats) : undefined,
        headToHead: asJson(summarizeHeadToHead(insight.headToHead)),
        homeRecent: asJson(summarizeRecent(homeTeamApiId, insight.homeRecent)),
        homeSeasonStats: insight.homeSeasonStats ? asJson(insight.homeSeasonStats) : undefined,
        matchId
      },
      update: {
        awayRecent: asJson(summarizeRecent(awayTeamApiId, insight.awayRecent)),
        awaySeasonStats: insight.awaySeasonStats ? asJson(insight.awaySeasonStats) : undefined,
        headToHead: asJson(summarizeHeadToHead(insight.headToHead)),
        homeRecent: asJson(summarizeRecent(homeTeamApiId, insight.homeRecent)),
        homeSeasonStats: insight.homeSeasonStats ? asJson(insight.homeSeasonStats) : undefined
      },
      where: {
        matchId
      }
    });
  }

  await prisma.match.updateMany({
    data: {
      historySyncedAt: syncedAt
    },
    where: {
      id: {
        in: matchIds
      }
    }
  });
}

export async function markFixturesFullySynced(matchIds: string[]) {
  await prisma.match.updateMany({
    data: {
      fullySyncedAt: serverNow()
    },
    where: {
      id: {
        in: matchIds
      }
    }
  });
}
