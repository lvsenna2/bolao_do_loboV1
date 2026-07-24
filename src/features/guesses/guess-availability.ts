import type { MatchStatus, RoundStatus } from "@prisma/client";

export function isRoundAcceptingGuesses(
  status: RoundStatus | string,
  endsAt: Date,
  now: Date
) {
  return status === "OPEN" && endsAt >= now;
}

export function isMatchAcceptingGuesses(
  status: MatchStatus | string,
  kickoff: Date,
  now: Date
) {
  return status === "SCHEDULED" && kickoff > now;
}
