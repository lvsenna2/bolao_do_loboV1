import type { ElectionTurn } from "@prisma/client";

type ElectionAnswer = {
  marginRange: string;
  runnerUpCandidateId: string;
  turn: ElectionTurn;
  winnerCandidateId: string;
  winnerRange: string;
};

export function isElectionWinningPrediction(
  prediction: ElectionAnswer | null | undefined,
  result: ElectionAnswer
) {
  return Boolean(
    prediction &&
    prediction.winnerCandidateId === result.winnerCandidateId &&
    prediction.runnerUpCandidateId === result.runnerUpCandidateId &&
    prediction.turn === result.turn &&
    prediction.winnerRange === result.winnerRange &&
    prediction.marginRange === result.marginRange
  );
}
