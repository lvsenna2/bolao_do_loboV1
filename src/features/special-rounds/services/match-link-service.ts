import { prisma } from "@/server/db";

const MATCH_TOLERANCE_MS = 6 * 60 * 60 * 1000;

function normalizeTeamName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

export async function resolveApiBackedSpecialRoundMatch(specialRoundId: string) {
  const round = await prisma.specialRound.findUnique({
    select: {
      awayTeamName: true,
      homeTeamName: true,
      matchStartsAt: true,
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

  if (!round || round.match?.apiId) {
    return round?.match ?? null;
  }

  const referenceKickoff = round.match?.kickoff ?? round.matchStartsAt;
  const candidates = await prisma.match.findMany({
    orderBy: [{ lastSyncedAt: "desc" }, { updatedAt: "desc" }],
    select: {
      apiId: true,
      awayTeam: { select: { name: true } },
      awayTeamId: true,
      homeTeam: { select: { name: true } },
      homeTeamId: true,
      id: true,
      kickoff: true
    },
    where: {
      apiId: { not: null },
      deletedAt: null,
      kickoff: {
        gte: new Date(referenceKickoff.getTime() - MATCH_TOLERANCE_MS),
        lte: new Date(referenceKickoff.getTime() + MATCH_TOLERANCE_MS)
      }
    }
  });
  const candidate = candidates.find(
    (item) =>
      (round.match &&
        item.awayTeamId === round.match.awayTeamId &&
        item.homeTeamId === round.match.homeTeamId) ||
      (normalizeTeamName(item.awayTeam.name) === normalizeTeamName(round.awayTeamName) &&
        normalizeTeamName(item.homeTeam.name) === normalizeTeamName(round.homeTeamName))
  );

  if (!candidate) {
    return round.match ?? null;
  }

  await prisma.specialRound.updateMany({
    data: { matchId: candidate.id },
    where: { id: specialRoundId }
  });

  return candidate;
}
