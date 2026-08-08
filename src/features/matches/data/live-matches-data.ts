import { prisma } from "@/server/db";

const teamSelect = {
  apiId: true,
  logo: true,
  name: true,
  shortName: true
} as const;

export type LiveMatchView = {
  awayScore: number | null;
  awayTeam: { apiId: number | null; logo: string | null; name: string; shortName: string | null };
  championshipName: string;
  elapsed: number | null;
  homeScore: number | null;
  homeTeam: { apiId: number | null; logo: string | null; name: string; shortName: string | null };
  id: string;
  status: string;
};

export async function getLiveMatches(limit = 8): Promise<LiveMatchView[]> {
  const matches = await prisma.match.findMany({
    orderBy: { kickoff: "asc" },
    select: {
      awayScore: true,
      awayTeam: { select: teamSelect },
      elapsed: true,
      homeScore: true,
      homeTeam: { select: teamSelect },
      id: true,
      round: {
        select: {
          season: {
            select: {
              championship: { select: { name: true } }
            }
          }
        }
      },
      status: true
    },
    take: limit,
    where: {
      deletedAt: null,
      round: { leagueId: null },
      status: { in: ["LIVE", "HALFTIME"] }
    }
  });

  return matches.map((match) => ({
    awayScore: match.awayScore,
    awayTeam: match.awayTeam,
    championshipName: match.round.season.championship.name,
    elapsed: match.elapsed,
    homeScore: match.homeScore,
    homeTeam: match.homeTeam,
    id: match.id,
    status: match.status
  }));
}
