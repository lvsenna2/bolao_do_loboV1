import type { Prisma } from "@prisma/client";

import {
  fallbackScoring,
  getPointsPreview,
  getScoringDefaults,
  type ScoringDefaults
} from "@/features/scoring/data/scoring-settings";
import { prisma } from "@/server/db";
import type { GuessDataResult } from "../types/guess-action-result";

export { getPointsPreview, getScoringDefaults, type ScoringDefaults };

type TeamView = {
  id: string;
  logo: string | null;
  name: string;
  shortName: string | null;
};

type GuessView = {
  awayPrediction: number | null;
  id: string;
  homePrediction: number | null;
  joker: boolean;
  leagueId: string | null;
  prediction: "HOME" | "DRAW" | "AWAY";
  score: {
    basePoints: number;
    bonusPoints: number;
    calculatedAt: string;
    exactScore: boolean;
    jokerApplied: boolean;
    totalPoints: number;
    winnerHit: boolean;
  } | null;
  submittedAt: string;
  updatedAt: string;
};

export type AvailableMatchView = {
  awayTeam: TeamView;
  championshipName: string;
  city: string | null;
  existingGuess: GuessView | null;
  homeTeam: TeamView;
  id: string;
  jokerAvailable: boolean;
  jokerLimit: number;
  kickoff: string;
  leagueId: string | null;
  leagueName: string | null;
  roundId: string;
  roundLabel: string;
  scoring: ScoringDefaults;
  stadium: string | null;
  status: string;
  usedJokersInRound: number;
};

export type RecentGuessView = {
  awayTeam: TeamView;
  championshipName: string;
  canEdit: boolean;
  guess: GuessView;
  homeTeam: TeamView;
  kickoff: string;
  matchId: string;
  roundLabel: string;
  status: string;
};

export type GuessesPageData = {
  availableMatches: AvailableMatchView[];
  recentGuesses: RecentGuessView[];
  scoring: ScoringDefaults;
  stats: {
    availableMatches: number;
    submittedGuesses: number;
    usedJokers: number;
  };
};

const guessSelect = {
  awayPrediction: true,
  id: true,
  homePrediction: true,
  joker: true,
  leagueId: true,
  prediction: true,
  score: {
    select: {
      basePoints: true,
      bonusPoints: true,
      calculatedAt: true,
      exactScore: true,
      jokerApplied: true,
      totalPoints: true,
      winnerHit: true
    }
  },
  submittedAt: true,
  updatedAt: true
} satisfies Prisma.GuessSelect;

const teamSelect = {
  id: true,
  logo: true,
  name: true,
  shortName: true
} satisfies Prisma.TeamSelect;

const matchRoundSelect = {
  id: true,
  league: {
    select: {
      id: true,
      name: true
    }
  },
  name: true,
  number: true,
  season: {
    select: {
      championship: {
        select: {
          name: true
        }
      },
      name: true,
      year: true
    }
  },
  status: true
} satisfies Prisma.RoundSelect;

type GuessRecord = Prisma.GuessGetPayload<{ select: typeof guessSelect }>;

function emptyResult<T>(message: string, data: T): GuessDataResult<T> {
  return {
    ok: false,
    message,
    data
  };
}

export function formatGuessDate(date: string | Date | null | undefined) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function getPredictionLabel(prediction: GuessView["prediction"]) {
  const labels = {
    AWAY: "Visitante",
    DRAW: "Empate",
    HOME: "Mandante"
  } satisfies Record<GuessView["prediction"], string>;

  return labels[prediction];
}

function mapGuess(guess: GuessRecord): GuessView {
  return {
    awayPrediction: guess.awayPrediction,
    homePrediction: guess.homePrediction,
    id: guess.id,
    joker: guess.joker,
    leagueId: guess.leagueId,
    prediction: guess.prediction,
    score: guess.score
      ? {
          basePoints: guess.score.basePoints,
          bonusPoints: guess.score.bonusPoints,
          calculatedAt: guess.score.calculatedAt.toISOString(),
          exactScore: guess.score.exactScore,
          jokerApplied: guess.score.jokerApplied,
          totalPoints: guess.score.totalPoints,
          winnerHit: guess.score.winnerHit
        }
      : null,
    submittedAt: guess.submittedAt.toISOString(),
    updatedAt: guess.updatedAt.toISOString()
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

function getCanEditGuess(kickoff: Date, roundStatus: string, matchStatus: string) {
  const now = new Date();

  return kickoff > now && roundStatus === "OPEN" && matchStatus === "SCHEDULED";
}

export async function getGuessesPageData(
  userId: string
): Promise<GuessDataResult<GuessesPageData>> {
  const empty: GuessesPageData = {
    availableMatches: [],
    recentGuesses: [],
    scoring: fallbackScoring,
    stats: {
      availableMatches: 0,
      submittedGuesses: 0,
      usedJokers: 0
    }
  };

  try {
    const now = new Date();
    const scoring = await getScoringDefaults();

    const [matches, recentGuesses, submittedGuesses, usedJokers] = await prisma.$transaction([
      prisma.match.findMany({
        orderBy: {
          kickoff: "asc"
        },
        select: {
          awayTeam: {
            select: teamSelect
          },
          city: true,
          homeTeam: {
            select: teamSelect
          },
          id: true,
          kickoff: true,
          round: {
            select: matchRoundSelect
          },
          roundId: true,
          stadium: true,
          status: true
        },
        take: 30,
        where: {
          deletedAt: null,
          kickoff: {
            gt: now
          },
          round: {
            endsAt: {
              gte: now
            },
            league: {
              members: {
                some: {
                  status: "ACTIVE",
                  userId
                }
              }
            },
            startsAt: {
              lte: now
            },
            status: "OPEN"
          },
          status: "SCHEDULED"
        }
      }),
      prisma.guess.findMany({
        orderBy: {
          updatedAt: "desc"
        },
        select: {
          ...guessSelect,
          match: {
            select: {
              awayTeam: {
                select: teamSelect
              },
              homeTeam: {
                select: teamSelect
              },
              id: true,
              kickoff: true,
              round: {
                select: matchRoundSelect
              },
              status: true
            }
          }
        },
        take: 20,
        where: {
          deletedAt: null,
          league: {
            members: {
              some: {
                status: "ACTIVE",
                userId
              }
            }
          },
          userId
        }
      }),
      prisma.guess.count({
        where: {
          deletedAt: null,
          league: {
            members: {
              some: {
                status: "ACTIVE",
                userId
              }
            }
          },
          userId
        }
      }),
      prisma.guess.count({
        where: {
          deletedAt: null,
          joker: true,
          league: {
            members: {
              some: {
                status: "ACTIVE",
                userId
              }
            }
          },
          userId
        }
      })
    ]);

    const matchIds = matches.map((match) => match.id);
    const leagueIds = Array.from(
      new Set(
        matches.map((match) => match.round.league?.id).filter((id): id is string => Boolean(id))
      )
    );
    const existingGuesses =
      matchIds.length > 0 && leagueIds.length > 0
        ? await prisma.guess.findMany({
            select: {
              ...guessSelect,
              matchId: true
            },
            where: {
              deletedAt: null,
              leagueId: {
                in: leagueIds
              },
              matchId: {
                in: matchIds
              },
              userId
            }
          })
        : [];
    const guessesByMatchAndLeague = new Map(
      existingGuesses.map((guess) => [`${guess.matchId}:${guess.leagueId}`, guess])
    );
    const roundIds = Array.from(new Set(matches.map((match) => match.roundId)));
    const roundJokers =
      roundIds.length > 0 && leagueIds.length > 0
        ? await prisma.guess.findMany({
            select: {
              leagueId: true,
              match: {
                select: {
                  roundId: true
                }
              }
            },
            where: {
              deletedAt: null,
              joker: true,
              leagueId: {
                in: leagueIds
              },
              match: {
                roundId: {
                  in: roundIds
                }
              },
              userId
            }
          })
        : [];

    const jokersByRound = roundJokers.reduce<Record<string, number>>((accumulator, guess) => {
      const key = `${guess.match.roundId}:${guess.leagueId}`;

      accumulator[key] = (accumulator[key] ?? 0) + 1;

      return accumulator;
    }, {});

    const availableMatches = matches.map((match) => {
      const leagueId = match.round.league?.id ?? null;
      const existingGuessRecord = leagueId
        ? guessesByMatchAndLeague.get(`${match.id}:${leagueId}`)
        : undefined;
      const existingGuess = existingGuessRecord ? mapGuess(existingGuessRecord) : null;
      const usedJokersInRound = leagueId ? (jokersByRound[`${match.roundId}:${leagueId}`] ?? 0) : 0;

      return {
        awayTeam: match.awayTeam,
        championshipName: match.round.season.championship.name,
        city: match.city,
        existingGuess,
        homeTeam: match.homeTeam,
        id: match.id,
        jokerAvailable:
          Boolean(existingGuess?.joker) || usedJokersInRound < scoring.jokerLimitPerRound,
        jokerLimit: scoring.jokerLimitPerRound,
        kickoff: match.kickoff.toISOString(),
        leagueId,
        leagueName: match.round.league?.name ?? null,
        roundId: match.roundId,
        roundLabel: getRoundLabel(match.round),
        scoring,
        stadium: match.stadium,
        status: match.status,
        usedJokersInRound
      };
    });

    return {
      ok: true,
      data: {
        availableMatches,
        recentGuesses: recentGuesses.map((guess) => ({
          awayTeam: guess.match.awayTeam,
          canEdit: getCanEditGuess(
            guess.match.kickoff,
            guess.match.round.status,
            guess.match.status
          ),
          championshipName: guess.match.round.season.championship.name,
          guess: mapGuess(guess),
          homeTeam: guess.match.homeTeam,
          kickoff: guess.match.kickoff.toISOString(),
          matchId: guess.match.id,
          roundLabel: getRoundLabel(guess.match.round),
          status: guess.match.status
        })),
        scoring,
        stats: {
          availableMatches: availableMatches.length,
          submittedGuesses,
          usedJokers
        }
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar seus palpites.", empty);
  }
}
