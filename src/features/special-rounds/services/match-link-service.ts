import { prisma } from "@/server/db";

const MATCH_TOLERANCE_MS = 15 * 60 * 1000;

export async function resolveApiBackedSpecialRoundMatch(specialRoundId: string) {
  const round = await prisma.specialRound.findUnique({
    select: {
      match: {
        select: {
          apiId: true,
          awayTeamId: true,
          homeTeamId: true,
          id: true,
          kickoff: true
        }
      }
    },
    where: { id: specialRoundId }
  });

  if (!round?.match || round.match.apiId) {
    return round?.match ?? null;
  }

  const candidate = await prisma.match.findFirst({
    orderBy: [{ lastSyncedAt: "desc" }, { updatedAt: "desc" }],
    select: {
      apiId: true,
      awayTeamId: true,
      homeTeamId: true,
      id: true,
      kickoff: true
    },
    where: {
      apiId: { not: null },
      awayTeamId: round.match.awayTeamId,
      deletedAt: null,
      homeTeamId: round.match.homeTeamId,
      kickoff: {
        gte: new Date(round.match.kickoff.getTime() - MATCH_TOLERANCE_MS),
        lte: new Date(round.match.kickoff.getTime() + MATCH_TOLERANCE_MS)
      }
    }
  });

  if (!candidate) {
    return round.match;
  }

  await prisma.specialRound.updateMany({
    data: { matchId: candidate.id },
    where: { id: specialRoundId, matchId: round.match.id }
  });

  return candidate;
}
