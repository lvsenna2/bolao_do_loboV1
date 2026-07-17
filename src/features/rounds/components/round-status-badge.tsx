import type { MatchStatus, RoundStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { getMatchStatusLabel, getRoundStatusLabel } from "../data/round-data";

type RoundStatusBadgeProps = {
  type?: "match" | "round";
  value: MatchStatus | RoundStatus;
};

function getTone(value: string) {
  if (["OPEN", "LIVE", "SCHEDULED"].includes(value)) {
    return "info" as const;
  }

  if (["FINISHED", "CLOSED"].includes(value)) {
    return "success" as const;
  }

  if (["POSTPONED", "SUSPENDED", "HALFTIME"].includes(value)) {
    return "warning" as const;
  }

  if (["CANCELLED"].includes(value)) {
    return "danger" as const;
  }

  return "neutral" as const;
}

export function RoundStatusBadge({ type = "round", value }: RoundStatusBadgeProps) {
  const label =
    type === "match"
      ? getMatchStatusLabel(value as MatchStatus)
      : getRoundStatusLabel(value as RoundStatus);

  return <Badge tone={getTone(value)}>{label}</Badge>;
}
