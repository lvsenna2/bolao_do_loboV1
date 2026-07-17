import { prisma } from "@/server/db";

import type { FootballCompetitionConfig } from "./competitions";

export type LeagueRoundSyncSummary = {
  matchesCreated: number;
  matchesUpdated: number;
  roundsCreated: number;
  roundsUpdated: number;
};

function emptySummary(): LeagueRoundSyncSummary {
  return { matchesCreated: 0, matchesUpdated: 0, roundsCreated: 0, roundsUpdated: 0 };
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

export async function syncChampionshipRoundsIntoLeague(
  leagueId: string,
  championshipId: string
) {
  const summary = emptySummary();
  const sourceRounds = await prisma.round.findMany({
    include: {
      matches: {
        orderBy: { kickoff: "asc" },
        where: { deletedAt: null }
      }
    },
    orderBy: [{ startsAt: "asc" }, { number: "asc" }],
    where: {
      leagueId: null,
      season: { championshipId }
    }
  });

  for (const sourceRound of sourceRounds) {
    const roundData = {
      description: sourceRound.description,
      endsAt: sourceRound.endsAt,
      name: sourceRound.name,
      startsAt: sourceRound.startsAt,
      status: sourceRound.status
    };
    const existingRound = await prisma.round.findFirst({
      select: { id: true },
      where: { leagueId, number: sourceRound.number, seasonId: sourceRound.seasonId }
    });
    const targetRound = existingRound
      ? await prisma.round.update({
          data: roundData,
          select: { id: true },
          where: { id: existingRound.id }
        })
      : await prisma.round.create({
          data: {
            ...roundData,
            leagueId,
            number: sourceRound.number,
            seasonId: sourceRound.seasonId
          },
          select: { id: true }
        });

    if (existingRound) summary.roundsUpdated += 1;
    else summary.roundsCreated += 1;

    const existingMatches = await prisma.match.findMany({
      select: {
        awayTeamId: true,
        homeTeamId: true,
        id: true
      },
      where: {
        roundId: targetRound.id
      }
    });
    const existingByTeams = new Map(
      existingMatches.map((match) => [
        `${match.homeTeamId}:${match.awayTeamId}`,
        match.id
      ])
    );

    for (const matchBatch of chunkValues(sourceRound.matches, 20)) {
      const results = await Promise.all(
        matchBatch.map(async (match) => {
          const matchData = {
            apiStatus: match.apiStatus,
            awayScore: match.awayScore,
            awayTeamId: match.awayTeamId,
            broadcast: match.broadcast,
            city: match.city,
            country: match.country,
            deletedAt: null,
            elapsed: match.elapsed,
            extraTime: match.extraTime,
            extraTimeAway: match.extraTimeAway,
            extraTimeHome: match.extraTimeHome,
            footballVenueId: match.footballVenueId,
            halftimeAway: match.halftimeAway,
            halftimeHome: match.halftimeHome,
            homeScore: match.homeScore,
            homeTeamId: match.homeTeamId,
            homologatedAt: match.homologatedAt,
            kickoff: match.kickoff,
            lastSyncedAt: match.lastSyncedAt,
            penaltyAway: match.penaltyAway,
            penaltyHome: match.penaltyHome,
            referee: match.referee,
            secondHalfAway: match.secondHalfAway,
            secondHalfHome: match.secondHalfHome,
            stadium: match.stadium,
            status: match.status,
            statusLong: match.statusLong
          };
          const key = `${match.homeTeamId}:${match.awayTeamId}`;
          const existingMatchId = existingByTeams.get(key);

          if (existingMatchId) {
            await prisma.match.update({ data: matchData, where: { id: existingMatchId } });
            return "updated" as const;
          }

          const created = await prisma.match.create({
            data: { ...matchData, apiId: null, roundId: targetRound.id },
            select: { id: true }
          });
          existingByTeams.set(key, created.id);
          return "created" as const;
        })
      );
      summary.matchesCreated += results.filter((result) => result === "created").length;
      summary.matchesUpdated += results.filter((result) => result === "updated").length;
    }
  }

  return summary;
}

export async function syncApiFootballCompetitionIntoLeagues(config: FootballCompetitionConfig) {
  const championship = await prisma.championship.findFirst({
    select: {
      id: true,
      leagues: {
        select: { id: true },
        where: { deletedAt: null }
      }
    },
    where: { apiId: config.leagueId, provider: "api-football" }
  });
  const total = emptySummary();
  if (!championship) return total;

  for (const leagueBatch of chunkValues(championship.leagues, 3)) {
    const summaries = await Promise.all(
      leagueBatch.map((league) =>
        syncChampionshipRoundsIntoLeague(league.id, championship.id)
      )
    );
    for (const current of summaries) {
      total.matchesCreated += current.matchesCreated;
      total.matchesUpdated += current.matchesUpdated;
      total.roundsCreated += current.roundsCreated;
      total.roundsUpdated += current.roundsUpdated;
    }
  }

  return total;
}
