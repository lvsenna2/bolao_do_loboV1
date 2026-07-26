import type { SpecialRoundMarketKind } from "@prisma/client";

import type { SpecialRoundAnswer } from "../types";

type ScorableMarket = {
  kind: SpecialRoundMarketKind;
  line?: number | null;
  points: number;
};

function normalize(value: SpecialRoundAnswer) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

function sameScore(left: SpecialRoundAnswer, right: SpecialRoundAnswer) {
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) {
    return false;
  }
  return left.home === right.home && left.away === right.away;
}

export function evaluateSpecialRoundAnswer(
  market: ScorableMarket,
  prediction: SpecialRoundAnswer,
  official: SpecialRoundAnswer
) {
  let hit = false;

  if (market.kind === "EXACT_SCORE") {
    hit = sameScore(prediction, official);
  } else if (
    ["TOTAL_GOALS", "TOTAL_CORNERS", "TOTAL_CARDS"].includes(market.kind) &&
    typeof official === "number" &&
    market.line !== null &&
    market.line !== undefined
  ) {
    const choice = normalize(prediction);
    hit =
      (choice === "OVER" && official > market.line) ||
      (choice === "UNDER" && official < market.line);
  } else {
    hit = JSON.stringify(normalize(prediction)) === JSON.stringify(normalize(official));
  }

  return {
    exactScoreHit: hit && market.kind === "EXACT_SCORE",
    hit,
    maxPointsHit: hit,
    points: hit ? market.points : 0
  };
}

export type StandingCandidate = {
  entryId: string;
  exactScoreHits: number;
  firstSubmittedAt: Date | null;
  hits: number;
  manualTieBreak: number;
  maxPointsHits: number;
  totalPoints: number;
};

export function rankSpecialRoundEntries(entries: StandingCandidate[]) {
  return [...entries]
    .sort((left, right) => {
      return (
        right.totalPoints - left.totalPoints ||
        right.hits - left.hits ||
        right.maxPointsHits - left.maxPointsHits ||
        right.exactScoreHits - left.exactScoreHits ||
        (left.firstSubmittedAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
          (right.firstSubmittedAt?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
        right.manualTieBreak - left.manualTieBreak
      );
    })
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}
