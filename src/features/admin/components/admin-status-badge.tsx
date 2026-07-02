import type {
  AccountStatus,
  ChampionshipStatus,
  LeagueStatus,
  PaymentStatus,
  UserRole
} from "@prisma/client";

import { Badge } from "@/components/ui/badge";

type AdminStatusBadgeProps = {
  value: AccountStatus | ChampionshipStatus | LeagueStatus | PaymentStatus | UserRole | string;
};

const successValues = new Set(["ACTIVE", "APPROVED", "OPEN", "SUPER_ADMIN", "ADMIN"]);
const warningValues = new Set([
  "PENDING",
  "PENDING_EMAIL",
  "PENDING_PAYMENT",
  "DRAFT",
  "SCHEDULED"
]);
const dangerValues = new Set(["BLOCKED", "DELETED", "FAILED", "CANCELLED"]);
const infoValues = new Set(["ORGANIZER", "MODERATOR", "LIVE"]);

function getTone(value: string) {
  if (successValues.has(value)) {
    return "success";
  }

  if (warningValues.has(value)) {
    return "warning";
  }

  if (dangerValues.has(value)) {
    return "danger";
  }

  if (infoValues.has(value)) {
    return "info";
  }

  return "neutral";
}

export function AdminStatusBadge({ value }: AdminStatusBadgeProps) {
  return <Badge tone={getTone(value)}>{value}</Badge>;
}
