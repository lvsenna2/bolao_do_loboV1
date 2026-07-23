import type { MatchStatus, Prediction, Prisma } from "@prisma/client";

import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import type { GuessDataResult } from "../types/guess-action-result";

type SearchParams = Record<string, string | string[] | undefined>;

type TeamView = {
  apiId: number | null;
  id: string;
  logo: string | null;
  name: string;
  shortName: string | null;
};

type ComparisonGuessRecord = {
  awayPrediction: number | null;
  homePrediction: number | null;
  id: string;
  joker: boolean;
  prediction: Prediction;
  score: {
    exactScore: boolean;
    totalPoints: number;
    winnerHit: boolean;
  } | null;
  submittedAt: Date;
  user: {
    avatarUrl: string | null;
    id: string;
    name: string;
    username: string;
  };
  userId: string;
};

export type ComparisonGuessView = {
  awayPrediction: number | null;
  homePrediction: number | null;
  id: string;
  joker: boolean;
  prediction: Prediction;
  score: {
    exactScore: boolean;
    totalPoints: number;
    winnerHit: boolean;
  } | null;
  submittedAt: string;
  user: {
    avatarUrl: string | null;
    id: string;
    name: string;
    username: string;
  };
};

export type GuessComparisonMatchView = {
  awayTeam: TeamView;
  championshipName: string;
  guesses: ComparisonGuessView[];
  hiddenGuessCount: number;
  homeTeam: TeamView;
  id: string;
  isVisible: boolean;
  kickoff: string;
  leagueName: string;
  ownGuess: ComparisonGuessView | null;
  roundLabel: string;
  status: MatchStatus;
};

export type GuessComparisonRoundView = {
  championshipName: string;
  id: string;
  label: string;
  leagueId: string;
  leagueName: string;
  matches: GuessComparisonMatchView[];
  number: number;
  startsAt: string;
};

export type GuessComparisonData = {
  leagues: Array<{
    id: string;
    name: string;
  }>;
  rounds: GuessComparisonRoundView[];
  selectedLeagueId: string;
  stats: {
    hiddenMatches: number;
    visibleMatches: number;
  };
};

const teamSelect = {
  apiId: true,
  id: true,
  logo: true,
  name: true,
  shortName: true
} satisfies Prisma.TeamSelect;

function getParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] : value;
}

function emptyResult<T>(message: string, data: T): GuessDataResult<T> {
  return {
    ok: false,
    message,
    data
  };
}

function getRoundLabel(round: {
  name: string | null;
  number: number;
  season: {
    name: string | null;
    year: number;
  };
}) {
  const roundName = round.name || `Rodada ${round.number}`;
  const seasonName = round.season.name || String(round.season.year);

  return `${roundName} - ${seasonName}`;
}

function mapGuess(guess: ComparisonGuessRecord): ComparisonGuessView {
  return {
    awayPrediction: guess.awayPrediction,
    homePrediction: guess.homePrediction,
    id: guess.id,
    joker: guess.joker,
    prediction: guess.prediction,
    score: guess.score,
    submittedAt: guess.submittedAt.toISOString(),
    user: guess.user
  };
}

export function canShowOtherGuesses(match: { kickoff: Date; status: MatchStatus }, now: Date) {
  return (
    match.kickoff <= now ||
    match.status === "LIVE" ||
    match.status === "HALFTIME" ||
    match.status === "FINISHED"
  );
}

export async function getGuessComparisonData(
  userId: string,
  searchParams: SearchParams
): Promise<GuessDataResult<GuessComparisonData>> {
  const empty: GuessComparisonData = {
    leagues: [],
    rounds: [],
    selectedLeagueId: "",
    stats: {
      hiddenMatches: 0,
      visibleMatches: 0
    }
  };

  try {
    const memberships = await prisma.leagueMember.findMany({
      orderBy: {
        joinedAt: "desc"
      },
      select: {
        league: {
          select: {
            id: true,
            name: true
          }
        }
      },
      where: {
        status: "ACTIVE",
        userId,
        league: {
          deletedAt: null,
          status: {
            not: "ARCHIVED"
          }
        }
      }
    });
    const leagues = memberships.map((membership) => membership.league);
    const requestedLeagueId = getParam(searchParams, "league");
    const selectedLeagueId =
      leagues.find((league) => league.id === requestedLeagueId)?.id ?? leagues[0]?.id ?? "";

    if (!selectedLeagueId) {
      return {
        ok: true,
        data: empty
      };
    }

    const now = serverNow();
    const roundRecords = await prisma.round.findMany({
      orderBy: [{ startsAt: "desc" }, { number: "desc" }],
      select: {
        id: true,
        league: {
          select: {
            championshipId: true,
            id: true,
            name: true
          }
        },
        matches: {
          orderBy: {
            kickoff: "asc"
          },
          select: {
            awayTeam: {
              select: teamSelect
            },
            guesses: {
              orderBy: {
                submittedAt: "asc"
              },
              select: {
                awayPrediction: true,
                homePrediction: true,
                id: true,
                joker: true,
                prediction: true,
                score: {
                  select: {
                    exactScore: true,
                    totalPoints: true,
                    winnerHit: true
                  }
                },
                submittedAt: true,
                user: {
                  select: {
                    avatarUrl: true,
                    id: true,
                    name: true,
                    username: true
                  }
                },
                userId: true
              },
              where: {
                deletedAt: null,
                OR: [{ leagueId: selectedLeagueId }, { leagueId: null }],
                user: {
                  memberships: {
                    some: {
                      leagueId: selectedLeagueId,
                      status: "ACTIVE"
                    }
                  }
                }
              }
            },
            homeTeam: {
              select: teamSelect
            },
            id: true,
            kickoff: true,
            status: true
          },
          where: {
            deletedAt: null,
            guesses: {
              some: {
                deletedAt: null,
                OR: [{ leagueId: selectedLeagueId }, { leagueId: null }]
              }
            }
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
        startsAt: true
      },
      take: 100,
      where: {
        leagueId: selectedLeagueId,
        league: {
          deletedAt: null,
          members: {
            some: {
              status: "ACTIVE",
              userId
            }
          }
        },
        matches: {
          some: {
            deletedAt: null,
            guesses: {
              some: {
                deletedAt: null,
                OR: [{ leagueId: selectedLeagueId }, { leagueId: null }]
              }
            }
          }
        }
      }
    });

    const rounds = roundRecords
      .filter(
        (round) =>
          round.league?.championshipId === round.season.championship.id && round.matches.length > 0
      )
      .map((round): GuessComparisonRoundView => {
        const league = round.league;

        if (!league) {
          throw new Error("Rodada sem liga.");
        }

        const roundLabel = getRoundLabel(round);
        const matches = round.matches.map((match): GuessComparisonMatchView => {
          const isVisible = canShowOtherGuesses(match, now);
          const ownGuess = match.guesses.find((guess) => guess.userId === userId) ?? null;
          const guesses = isVisible
            ? match.guesses.map(mapGuess)
            : match.guesses.filter((guess) => guess.userId === userId).map(mapGuess);

          return {
            awayTeam: match.awayTeam,
            championshipName: round.season.championship.name,
            guesses,
            hiddenGuessCount: isVisible
              ? 0
              : match.guesses.filter((guess) => guess.userId !== userId).length,
            homeTeam: match.homeTeam,
            id: match.id,
            isVisible,
            kickoff: match.kickoff.toISOString(),
            leagueName: league.name,
            ownGuess: ownGuess ? mapGuess(ownGuess) : null,
            roundLabel,
            status: match.status
          };
        });

        return {
          championshipName: round.season.championship.name,
          id: round.id,
          label: roundLabel,
          leagueId: league.id,
          leagueName: league.name,
          matches,
          number: round.number,
          startsAt: round.startsAt.toISOString()
        };
      });
    const mappedMatches = rounds.flatMap((round) => round.matches);

    return {
      ok: true,
      data: {
        leagues,
        rounds,
        selectedLeagueId,
        stats: {
          hiddenMatches: mappedMatches.filter((match) => !match.isVisible).length,
          visibleMatches: mappedMatches.filter((match) => match.isVisible).length
        }
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar a comparacao de palpites.", empty);
  }
}
