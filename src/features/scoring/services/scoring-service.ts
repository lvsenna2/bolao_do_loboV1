import type { Prediction } from "@prisma/client";

import { prisma } from "@/server/db";
import { getScoringDefaults, type ScoringDefaults } from "../data/scoring-settings";

type GuessForScoring = {
  awayPrediction: number | null;
  homePrediction: number | null;
  id: string;
  joker: boolean;
  leagueId: string | null;
  matchId: string;
  prediction: Prediction;
  userId: string;
};

export type CalculatedScore = {
  basePoints: number;
  bonusPoints: number;
  exactScore: boolean;
  jokerApplied: boolean;
  totalPoints: number;
  winnerHit: boolean;
};

export type MatchScoringSummary = {
  awayScore: number;
  basePoints: number;
  bonusPoints: number;
  exactScores: number;
  homeScore: number;
  matchId: string;
  processedGuesses: number;
  totalPoints: number;
  winnerHits: number;
};

export function getOfficialPrediction(homeScore: number, awayScore: number): Prediction {
  if (homeScore > awayScore) {
    return "HOME";
  }

  if (homeScore < awayScore) {
    return "AWAY";
  }

  return "DRAW";
}

export function calculateGuessScore(
  guess: Pick<GuessForScoring, "awayPrediction" | "homePrediction" | "joker" | "prediction">,
  official: {
    awayScore: number;
    homeScore: number;
  },
  scoring: ScoringDefaults
): CalculatedScore {
  const officialPrediction = getOfficialPrediction(official.homeScore, official.awayScore);
  const winnerHit = guess.prediction === officialPrediction;
  const exactScore =
    guess.homePrediction === official.homeScore && guess.awayPrediction === official.awayScore;
  const basePoints = winnerHit ? scoring.winnerHit : 0;
  const bonusPoints = exactScore ? scoring.exactScoreBonus : 0;
  const subtotal = basePoints + bonusPoints;
  const totalPoints = guess.joker ? subtotal * scoring.jokerMultiplier : subtotal;

  return {
    basePoints,
    bonusPoints,
    exactScore,
    jokerApplied: guess.joker,
    totalPoints,
    winnerHit
  };
}

export async function processMatchScores(matchId: string): Promise<MatchScoringSummary> {
  const match = await prisma.match.findUnique({
    select: {
      awayScore: true,
      homeScore: true,
      homologatedAt: true,
      id: true
    },
    where: {
      id: matchId
    }
  });

  if (!match || match.homeScore === null || match.awayScore === null || !match.homologatedAt) {
    throw new Error("MATCH_NOT_HOMOLOGATED");
  }

  const homeScore = match.homeScore;
  const awayScore = match.awayScore;

  const [scoring, guesses] = await Promise.all([
    getScoringDefaults(),
    prisma.guess.findMany({
      select: {
        awayPrediction: true,
        homePrediction: true,
        id: true,
        joker: true,
        leagueId: true,
        matchId: true,
        prediction: true,
        userId: true
      },
      where: {
        deletedAt: null,
        matchId
      }
    })
  ]);

  const now = new Date();
  const calculatedScores = guesses.map((guess) => ({
    guess,
    score: calculateGuessScore(
      guess,
      {
        awayScore,
        homeScore
      },
      scoring
    )
  }));

  if (calculatedScores.length > 0) {
    await prisma.$transaction(
      calculatedScores.map(({ guess, score }) =>
        prisma.score.upsert({
          create: {
            basePoints: score.basePoints,
            bonusPoints: score.bonusPoints,
            calculatedAt: now,
            exactScore: score.exactScore,
            guessId: guess.id,
            jokerApplied: score.jokerApplied,
            leagueId: guess.leagueId,
            matchId: guess.matchId,
            totalPoints: score.totalPoints,
            userId: guess.userId,
            winnerHit: score.winnerHit
          },
          update: {
            basePoints: score.basePoints,
            bonusPoints: score.bonusPoints,
            calculatedAt: now,
            exactScore: score.exactScore,
            jokerApplied: score.jokerApplied,
            leagueId: guess.leagueId,
            totalPoints: score.totalPoints,
            winnerHit: score.winnerHit
          },
          where: {
            guessId: guess.id
          }
        })
      )
    );
  }

  return calculatedScores.reduce<MatchScoringSummary>(
    (summary, item) => ({
      ...summary,
      basePoints: summary.basePoints + item.score.basePoints,
      bonusPoints: summary.bonusPoints + item.score.bonusPoints,
      exactScores: summary.exactScores + (item.score.exactScore ? 1 : 0),
      processedGuesses: summary.processedGuesses + 1,
      totalPoints: summary.totalPoints + item.score.totalPoints,
      winnerHits: summary.winnerHits + (item.score.winnerHit ? 1 : 0)
    }),
    {
      awayScore,
      basePoints: 0,
      bonusPoints: 0,
      exactScores: 0,
      homeScore,
      matchId,
      processedGuesses: 0,
      totalPoints: 0,
      winnerHits: 0
    }
  );
}
