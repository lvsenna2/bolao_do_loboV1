import type { MatchStatus, Prisma, RoundStatus } from "@prisma/client";

import { prisma } from "@/server/db";

type SearchParams = Record<string, string | string[] | undefined>;

type TeamView = {
  id: string;
  logo: string | null;
  name: string;
  shortName: string | null;
};

type GuessView = {
  awayPrediction: number | null;
  homePrediction: number | null;
  id: string;
  joker: boolean;
  score: {
    exactScore: boolean;
    totalPoints: number;
    winnerHit: boolean;
  } | null;
};

export type RoundMatchView = {
  awayScore: number | null;
  awayTeam: TeamView;
  city: string | null;
  guess: GuessView | null;
  homeScore: number | null;
  homeTeam: TeamView;
  id: string;
  kickoff: string;
  stadium: string | null;
  status: MatchStatus;
};

export type RoundView = {
  championshipId: string;
  championshipName: string;
  description: string | null;
  endsAt: string;
  id: string;
  leagueId: string | null;
  leagueName: string | null;
  matches: RoundMatchView[];
  name: string | null;
  number: number;
  remainingMatches: number;
  seasonName: string;
  startsAt: string;
  status: RoundStatus;
  submittedGuesses: number;
  totalMatches: number;
};

export type RoundFilterOption = {
  id: string;
  name: string;
};

export type RoundsPageData = {
  championships: RoundFilterOption[];
  leagues: RoundFilterOption[];
  rounds: RoundView[];
  stats: {
    activeRounds: number;
    openRounds: number;
    remainingMatches: number;
    totalRounds: number;
  };
};

export type RoundDataResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      message: string;
      data: T;
    };

const teamSelect = {
  id: true,
  logo: true,
  name: true,
  shortName: true
} satisfies Prisma.TeamSelect;

function getParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] : value;
}

function emptyResult<T>(message: string, data: T): RoundDataResult<T> {
  return {
    ok: false,
    message,
    data
  };
}

export function formatRoundDate(date: string | Date | null | undefined) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function getRoundLabel(round: Pick<RoundView, "name" | "number">) {
  return round.name || `Rodada ${round.number}`;
}

export function getRoundStatusLabel(status: RoundStatus) {
  const labels = {
    ARCHIVED: "Arquivada",
    CLOSED: "Fechada",
    FINISHED: "Finalizada",
    LIVE: "Em andamento",
    OPEN: "Aberta",
    SCHEDULED: "Agendada"
  } satisfies Record<RoundStatus, string>;

  return labels[status];
}

export function getMatchStatusLabel(status: MatchStatus) {
  const labels = {
    CANCELLED: "Cancelada",
    FINISHED: "Encerrada",
    HALFTIME: "Intervalo",
    LIVE: "Ao vivo",
    POSTPONED: "Adiada",
    SCHEDULED: "Agendada"
  } satisfies Record<MatchStatus, string>;

  return labels[status];
}

function getSeasonName(season: { name: string | null; year: number }) {
  return season.name || String(season.year);
}

export async function getRoundsPageData(
  userId: string,
  searchParams: SearchParams
): Promise<RoundDataResult<RoundsPageData>> {
  const empty: RoundsPageData = {
    championships: [],
    leagues: [],
    rounds: [],
    stats: {
      activeRounds: 0,
      openRounds: 0,
      remainingMatches: 0,
      totalRounds: 0
    }
  };

  try {
    const status = getParam(searchParams, "status") as RoundStatus | undefined;
    const championshipId = getParam(searchParams, "championship");
    const leagueId = getParam(searchParams, "league");
    const where: Prisma.RoundWhereInput = {
      league: {
        members: {
          some: {
            status: "ACTIVE",
            userId
          }
        }
      },
      ...(status ? { status } : {}),
      ...(leagueId ? { leagueId } : {}),
      ...(championshipId
        ? {
            season: {
              championshipId
            }
          }
        : {})
    };

    const [rounds, championships, leagues] = await prisma.$transaction([
      prisma.round.findMany({
        orderBy: [
          {
            startsAt: "desc"
          },
          {
            number: "desc"
          }
        ],
        select: {
          description: true,
          endsAt: true,
          id: true,
          league: {
            select: {
              id: true,
              name: true
            }
          },
          matches: {
            orderBy: {
              kickoff: "asc"
            },
            select: {
              awayScore: true,
              awayTeam: {
                select: teamSelect
              },
              city: true,
              guesses: {
                select: {
                  awayPrediction: true,
                  homePrediction: true,
                  id: true,
                  joker: true,
                  score: {
                    select: {
                      exactScore: true,
                      totalPoints: true,
                      winnerHit: true
                    }
                  }
                },
                take: 1,
                where: {
                  deletedAt: null,
                  userId
                }
              },
              homeScore: true,
              homeTeam: {
                select: teamSelect
              },
              id: true,
              kickoff: true,
              stadium: true,
              status: true
            },
            where: {
              deletedAt: null
            }
          },
          name: true,
          number: true,
          season: {
            select: {
              championship: {
                select: {
                  id: true,
                  name: true
                }
              },
              name: true,
              year: true
            }
          },
          startsAt: true,
          status: true
        },
        take: 50,
        where
      }),
      prisma.championship.findMany({
        orderBy: {
          name: "asc"
        },
        select: {
          id: true,
          name: true
        },
        where: {
          deletedAt: null
        }
      }),
      prisma.league.findMany({
        orderBy: {
          name: "asc"
        },
        select: {
          id: true,
          name: true
        },
        where: {
          deletedAt: null,
          members: {
            some: {
              status: "ACTIVE",
              userId
            }
          }
        }
      })
    ]);

    const mappedRounds = rounds.map((round) => {
      const matches = round.matches.map((match) => ({
        awayScore: match.awayScore,
        awayTeam: match.awayTeam,
        city: match.city,
        guess: match.guesses[0] ?? null,
        homeScore: match.homeScore,
        homeTeam: match.homeTeam,
        id: match.id,
        kickoff: match.kickoff.toISOString(),
        stadium: match.stadium,
        status: match.status
      }));
      const remainingMatches = matches.filter((match) =>
        ["SCHEDULED", "LIVE", "HALFTIME", "POSTPONED"].includes(match.status)
      ).length;

      return {
        championshipId: round.season.championship.id,
        championshipName: round.season.championship.name,
        description: round.description,
        endsAt: round.endsAt.toISOString(),
        id: round.id,
        leagueId: round.league?.id ?? null,
        leagueName: round.league?.name ?? null,
        matches,
        name: round.name,
        number: round.number,
        remainingMatches,
        seasonName: getSeasonName(round.season),
        startsAt: round.startsAt.toISOString(),
        status: round.status,
        submittedGuesses: matches.filter((match) => match.guess).length,
        totalMatches: matches.length
      };
    });

    return {
      ok: true,
      data: {
        championships,
        leagues,
        rounds: mappedRounds,
        stats: {
          activeRounds: mappedRounds.filter(
            (round) => round.status === "OPEN" || round.status === "LIVE"
          ).length,
          openRounds: mappedRounds.filter((round) => round.status === "OPEN").length,
          remainingMatches: mappedRounds.reduce((sum, round) => sum + round.remainingMatches, 0),
          totalRounds: mappedRounds.length
        }
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar rodadas.", empty);
  }
}
