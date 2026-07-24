import type { MatchStatus, Prisma, RoundStatus } from "@prisma/client";

import {
  fallbackScoring,
  getPointsPreview,
  getScoringDefaults,
  type ScoringDefaults
} from "@/features/scoring/data/scoring-settings";
import { formatDateTimeInSaoPaulo, serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import { isMatchAcceptingGuesses, isRoundAcceptingGuesses } from "../guess-availability";
import type { GuessDataResult } from "../types/guess-action-result";

export { getPointsPreview, getScoringDefaults, type ScoringDefaults };

export type TeamView = {
  apiId: number | null;
  id: string;
  logo: string | null;
  name: string;
  shortName: string | null;
};

export type GuessView = {
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

export type GuessMatchView = {
  awayScore: number | null;
  awayTeam: TeamView;
  canEdit: boolean;
  championshipName: string;
  city: string | null;
  elapsed: number | null;
  existingGuess: GuessView | null;
  homeScore: number | null;
  homeTeam: TeamView;
  id: string;
  kickoff: string;
  leagueId: string;
  leagueName: string;
  roundId: string;
  roundLabel: string;
  scoring: ScoringDefaults;
  stadium: string | null;
  status: MatchStatus;
  statusLong: string | null;
};

export type GuessRoundView = {
  championshipName: string;
  endsAt: string;
  id: string;
  jokerLimit: number;
  jokerMatchId: string | null;
  jokerMatchName: string | null;
  label: string;
  leagueId: string;
  leagueName: string;
  matches: GuessMatchView[];
  startsAt: string;
  status: RoundStatus;
  usedJokers: number;
};

export type GuessesPageData = {
  rounds: GuessRoundView[];
  scoring: ScoringDefaults;
  stats: {
    blockedMatches: number;
    pendingGuesses: number;
    submittedGuesses: number;
    totalMatches: number;
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
  apiId: true,
  id: true,
  logo: true,
  name: true,
  shortName: true
} satisfies Prisma.TeamSelect;

type GuessRecord = Prisma.GuessGetPayload<{ select: typeof guessSelect }>;

function emptyResult<T>(message: string, data: T): GuessDataResult<T> {
  return {
    ok: false,
    message,
    data
  };
}

export function formatGuessDate(date: string | Date | null | undefined) {
  return formatDateTimeInSaoPaulo(date);
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

function canEditMatch(
  kickoff: Date,
  roundEndsAt: Date,
  roundStatus: RoundStatus,
  matchStatus: MatchStatus,
  now: Date
) {
  return (
    isRoundAcceptingGuesses(roundStatus, roundEndsAt, now) &&
    isMatchAcceptingGuesses(matchStatus, kickoff, now)
  );
}

function matchName(homeTeam: TeamView, awayTeam: TeamView) {
  return `${homeTeam.name} x ${awayTeam.name}`;
}

export async function getGuessesPageData(
  userId: string
): Promise<GuessDataResult<GuessesPageData>> {
  const empty: GuessesPageData = {
    rounds: [],
    scoring: fallbackScoring,
    stats: {
      blockedMatches: 0,
      pendingGuesses: 0,
      submittedGuesses: 0,
      totalMatches: 0,
      usedJokers: 0
    }
  };

  try {
    const now = serverNow();
    const [scoring, roundRecords] = await Promise.all([
      getScoringDefaults(),
      prisma.round.findMany({
        orderBy: [{ startsAt: "desc" }, { number: "desc" }],
        select: {
          endsAt: true,
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
              awayScore: true,
              awayTeam: {
                select: teamSelect
              },
              city: true,
              elapsed: true,
              guesses: {
                orderBy: {
                  updatedAt: "desc"
                },
                select: guessSelect,
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
              status: true,
              statusLong: true
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
        where: {
          league: {
            deletedAt: null,
            members: {
              some: {
                status: "ACTIVE",
                userId
              }
            }
          },
          leagueId: {
            not: null
          },
          endsAt: {
            gte: now
          },
          matches: {
            some: {
              deletedAt: null
            }
          },
          status: {
            in: ["OPEN", "LIVE"]
          }
        }
      })
    ]);

    const rounds = roundRecords
      .filter(
        (round) =>
          round.league && round.league.championshipId === round.season.championship.id
      )
      .map((round): GuessRoundView => {
        const league = round.league;

        if (!league) {
          throw new Error("Rodada sem liga.");
        }

        const roundLabel = getRoundLabel(round);
        const matches = round.matches.map((match): GuessMatchView => {
          const guessRecord = match.guesses.find((guess) => guess.leagueId === league.id) ?? null;

          return {
            awayScore: match.awayScore,
            awayTeam: match.awayTeam,
            canEdit: canEditMatch(
              match.kickoff,
              round.endsAt,
              round.status,
              match.status,
              now
            ),
            championshipName: round.season.championship.name,
            city: match.city,
            elapsed: match.elapsed,
            existingGuess: guessRecord ? mapGuess(guessRecord) : null,
            homeScore: match.homeScore,
            homeTeam: match.homeTeam,
            id: match.id,
            kickoff: match.kickoff.toISOString(),
            leagueId: league.id,
            leagueName: league.name,
            roundId: round.id,
            roundLabel,
            scoring,
            stadium: match.stadium,
            status: match.status,
            statusLong: match.statusLong
          };
        });
        const jokerMatches = matches.filter((match) => match.existingGuess?.joker);
        const jokerMatch = jokerMatches[0] ?? null;

        return {
          championshipName: round.season.championship.name,
          endsAt: round.endsAt.toISOString(),
          id: round.id,
          jokerLimit: scoring.jokerLimitPerRound,
          jokerMatchId: jokerMatch?.id ?? null,
          jokerMatchName: jokerMatch
            ? matchName(jokerMatch.homeTeam, jokerMatch.awayTeam)
            : null,
          label: roundLabel,
          leagueId: league.id,
          leagueName: league.name,
          matches,
          startsAt: round.startsAt.toISOString(),
          status: round.status,
          usedJokers: jokerMatches.length
        };
      })
      .sort((left, right) => {
        const leftOpen = left.status === "OPEN" || left.status === "LIVE" ? 1 : 0;
        const rightOpen = right.status === "OPEN" || right.status === "LIVE" ? 1 : 0;

        return rightOpen - leftOpen || right.startsAt.localeCompare(left.startsAt);
      });
    const allMatches = rounds.flatMap((round) => round.matches);
    const isComplete = (match: GuessMatchView) =>
      Boolean(
        match.existingGuess &&
          match.existingGuess.homePrediction !== null &&
          match.existingGuess.awayPrediction !== null
      );

    return {
      ok: true,
      data: {
        rounds,
        scoring,
        stats: {
          blockedMatches: allMatches.filter((match) => !match.canEdit).length,
          pendingGuesses: allMatches.filter((match) => match.canEdit && !isComplete(match)).length,
          submittedGuesses: allMatches.filter(isComplete).length,
          totalMatches: allMatches.length,
          usedJokers: allMatches.filter((match) => match.existingGuess?.joker).length
        }
      }
    };
  } catch {
    return emptyResult("Nao foi possivel carregar seus palpites.", empty);
  }
}
