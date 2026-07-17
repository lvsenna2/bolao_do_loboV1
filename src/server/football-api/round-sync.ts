import type { RoundStatus } from "@prisma/client";

export type FootballRoundSyncState = {
  endsAt: Date;
  startsAt: Date;
  status: RoundStatus;
};

export function mergeFootballRoundState(
  current: FootballRoundSyncState,
  incoming: FootballRoundSyncState
): FootballRoundSyncState {
  const incomingHasStarted = incoming.status === "LIVE" || incoming.status === "FINISHED";
  const currentIsManaged = ["OPEN", "CLOSED", "ARCHIVED", "LIVE", "FINISHED"].includes(
    current.status
  );

  return {
    endsAt: current.endsAt > incoming.endsAt ? current.endsAt : incoming.endsAt,
    startsAt: current.startsAt < incoming.startsAt ? current.startsAt : incoming.startsAt,
    status: incomingHasStarted ? incoming.status : currentIsManaged ? current.status : incoming.status
  };
}
