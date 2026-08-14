import type {
  AccountStatus,
  ChampionshipStatus,
  LeagueStatus,
  PaymentStatus,
  UserRole
} from "@prisma/client";

import { Badge } from "@/components/ui/badge";

type AdminStatusBadgeProps = {
  /** Texto exibido, quando o status precisa aparecer traduzido. A cor continua vindo de `value`. */
  label?: string;
  value: AccountStatus | ChampionshipStatus | LeagueStatus | PaymentStatus | UserRole | string;
};

const successValues = new Set(["ACTIVE", "APPROVED", "OPEN", "PAID", "SUPER_ADMIN", "ADMIN"]);
const warningValues = new Set([
  "PENDING",
  "PENDING_EMAIL",
  "PENDING_PAYMENT",
  "DRAFT",
  "REQUESTED",
  "SCHEDULED"
]);
const dangerValues = new Set([
  "BLOCKED",
  "DELETED",
  "FAILED",
  "CANCELLED",
  "REJECTED",
  "PIX_FAILED"
]);
const infoValues = new Set(["ORGANIZER", "MODERATOR", "LIVE", "PIX_PROCESSING"]);

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

export function AdminStatusBadge({ label, value }: AdminStatusBadgeProps) {
  return <Badge tone={getTone(value)}>{label ?? value}</Badge>;
}
