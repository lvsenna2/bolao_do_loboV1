import type { SpecialRoundStatus } from "@prisma/client";

export const blockingSpecialRoundStatuses: SpecialRoundStatus[] = [
  "DRAFT",
  "REGISTRATION_OPEN",
  "PREDICTIONS_OPEN",
  "PREDICTIONS_CLOSED",
  "AWAITING_RESULT",
  "CALCULATING"
];

export function canDeleteSpecialRoundEntries(
  entries: { paymentStatus: string; transactionId: string | null }[]
) {
  return entries.every(
    (entry) => !["APPROVED", "REFUNDED"].includes(entry.paymentStatus) && !entry.transactionId
  );
}

const transitions: Record<SpecialRoundStatus, SpecialRoundStatus[]> = {
  DRAFT: ["REGISTRATION_OPEN", "CANCELLED"],
  REGISTRATION_OPEN: ["PREDICTIONS_OPEN", "CANCELLED"],
  PREDICTIONS_OPEN: ["PREDICTIONS_CLOSED", "CANCELLED"],
  PREDICTIONS_CLOSED: ["AWAITING_RESULT", "CANCELLED"],
  AWAITING_RESULT: ["CALCULATING", "CANCELLED"],
  CALCULATING: ["AWAITING_RESULT", "FINALIZED", "CANCELLED"],
  FINALIZED: [],
  CANCELLED: []
};

export function canTransitionSpecialRound(current: SpecialRoundStatus, next: SpecialRoundStatus) {
  return current === next || transitions[current].includes(next);
}

export function assertSpecialRoundTransition(
  current: SpecialRoundStatus,
  next: SpecialRoundStatus
) {
  if (!canTransitionSpecialRound(current, next)) {
    throw new Error(`SPECIAL_ROUND_INVALID_TRANSITION:${current}:${next}`);
  }
}

export function isPredictionWindowOpen(input: {
  closesAt: Date;
  matchStartsAt: Date;
  now: Date;
  opensAt: Date;
  status: SpecialRoundStatus;
}) {
  return (
    input.status === "PREDICTIONS_OPEN" &&
    input.now >= input.opensAt &&
    input.now < input.closesAt &&
    input.now < input.matchStartsAt
  );
}
