import type { UserRole } from "@prisma/client";

import { prisma } from "@/server/db";

const adminRoles: UserRole[] = ["ADMIN", "SUPER_ADMIN"];

export async function getMatchDetail(matchId: string, user: { id: string; role: UserRole }) {
  const match = await prisma.match.findFirst({
    select: {
      apiStatus: true,
      awayScore: true,
      awayTeam: {
        select: { apiId: true, id: true, logo: true, name: true, shortName: true }
      },
      city: true,
      elapsed: true,
      events: {
        include: {
          assistPlayer: true,
          player: true,
          team: { select: { id: true, logo: true, name: true, shortName: true } }
        },
        orderBy: [{ elapsed: "asc" }, { extra: "asc" }]
      },
      extraTime: true,
      extraTimeAway: true,
      extraTimeHome: true,
      footballVenue: true,
      halftimeAway: true,
      halftimeHome: true,
      historySyncedAt: true,
      homeScore: true,
      homeTeam: {
        select: { apiId: true, id: true, logo: true, name: true, shortName: true }
      },
      id: true,
      insight: true,
      kickoff: true,
      lastSyncedAt: true,
      lineups: {
        include: {
          players: {
            include: { player: true },
            orderBy: [{ role: "asc" }, { sortOrder: "asc" }]
          },
          team: { select: { id: true, logo: true, name: true, shortName: true } }
        },
        orderBy: { teamId: "asc" }
      },
      penaltyAway: true,
      penaltyHome: true,
      playerStatistics: {
        include: { player: true, team: { select: { id: true, name: true } } },
        orderBy: { player: { name: "asc" } }
      },
      referee: true,
      round: {
        select: {
          league: { select: { id: true, name: true } },
          name: true,
          number: true,
          season: {
            select: {
              championship: { select: { id: true, logo: true, name: true } },
              id: true,
              name: true,
              year: true
            }
          }
        }
      },
      secondHalfAway: true,
      secondHalfHome: true,
      stadium: true,
      statistics: {
        include: { team: { select: { id: true, name: true } } },
        orderBy: [{ teamId: "asc" }, { type: "asc" }]
      },
      status: true,
      statusLong: true
    },
    where: {
      id: matchId,
      deletedAt: null,
      ...(adminRoles.includes(user.role)
        ? {}
        : {
            round: {
              league: {
                is: {
                  OR: [
                    { ownerId: user.id },
                    {
                      members: {
                        some: { status: "ACTIVE" as const, userId: user.id }
                      }
                    }
                  ]
                }
              }
            }
          })
    }
  });

  if (!match) return null;

  const standings = await prisma.competitionStanding.findMany({
    orderBy: { rank: "asc" },
    select: {
      form: true,
      goalsAgainst: true,
      goalsFor: true,
      points: true,
      rank: true,
      teamId: true
    },
    where: {
      seasonId: match.round.season.id,
      teamId: { in: [match.homeTeam.id, match.awayTeam.id] }
    }
  });

  return { ...match, standings };
}
