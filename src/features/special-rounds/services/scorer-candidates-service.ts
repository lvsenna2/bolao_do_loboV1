import "server-only";

import { prisma } from "@/server/db";
import { fetchApiFootballTeamSquad } from "@/server/football-api/client";
import { upsertFootballPlayer } from "@/server/football-api/detail-service";

import type { GoalScorerPlayerOption } from "./default-markets";

type TeamInput = {
  apiId: number | null;
  side: "AWAY" | "HOME";
};

export type SquadCandidatesResult = {
  callsUsed: number;
  players: GoalScorerPlayerOption[];
  unavailableTeams: Array<"AWAY" | "HOME">;
};

async function mapInBatches<T, R>(values: T[], size: number, mapper: (value: T) => Promise<R>) {
  const mapped: R[] = [];
  for (let index = 0; index < values.length; index += size) {
    mapped.push(...(await Promise.all(values.slice(index, index + size).map(mapper))));
  }
  return mapped;
}

export async function fetchSquadGoalScorerCandidates({
  awayTeam,
  homeTeam
}: {
  awayTeam: TeamInput;
  homeTeam: TeamInput;
}): Promise<SquadCandidatesResult> {
  const teams = [homeTeam, awayTeam];
  const results = await Promise.all(
    teams.map(async (team) => ({
      result: team.apiId ? await fetchApiFootballTeamSquad(team.apiId) : null,
      side: team.side
    }))
  );
  const callsUsed = results.reduce((total, item) => total + (item.result?.callsUsed ?? 0), 0);
  const unavailableTeams = results
    .filter((item) => !item.result?.ok || item.result.data.length === 0)
    .map((item) => item.side);
  const externalPlayers = results.flatMap((item) =>
    item.result?.ok
      ? item.result.data.flatMap((squad) =>
          squad.players.map((player) => ({ player, side: item.side }))
        )
      : []
  );
  const uniquePlayers = externalPlayers.filter(
    (item, index, list) =>
      list.findIndex((candidate) => candidate.player.apiId === item.player.apiId) === index
  );
  const storedPlayers = await mapInBatches(uniquePlayers, 6, async (item) => ({
    player: await upsertFootballPlayer(item.player),
    side: item.side
  }));

  return {
    callsUsed,
    players: storedPlayers.map((item) => ({
      id: item.player.id,
      name: item.player.name,
      side: item.side
    })),
    unavailableTeams
  };
}

export async function getStoredGoalScorerCandidates(matchId: string) {
  const match = await prisma.match.findUnique({
    include: {
      lineups: {
        include: { players: { include: { player: true } } }
      },
      playerStatistics: { include: { player: true } }
    },
    where: { id: matchId }
  });
  if (!match) return [];

  return [
    ...match.lineups.flatMap((lineup) =>
      lineup.players.map((item) => ({
        id: item.player.id,
        name: item.player.name,
        side: lineup.teamId === match.homeTeamId ? ("HOME" as const) : ("AWAY" as const)
      }))
    ),
    ...match.playerStatistics.map((item) => ({
      id: item.player.id,
      name: item.player.name,
      side: item.teamId === match.homeTeamId ? ("HOME" as const) : ("AWAY" as const)
    }))
  ];
}
