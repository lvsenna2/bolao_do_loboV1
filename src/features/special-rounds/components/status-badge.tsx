import type { SpecialRoundStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";

const labels: Record<SpecialRoundStatus, string> = {
  AWAITING_RESULT: "Aguardando resultado",
  CALCULATING: "Em apuracao",
  CANCELLED: "Cancelada",
  DRAFT: "Rascunho",
  FINALIZED: "Finalizada",
  PREDICTIONS_CLOSED: "Palpites encerrados",
  PREDICTIONS_OPEN: "Palpites abertos",
  REGISTRATION_OPEN: "Inscricoes abertas"
};

export function SpecialRoundStatusBadge({ status }: { status: SpecialRoundStatus }) {
  const tone =
    status === "FINALIZED"
      ? "success"
      : status === "CANCELLED"
        ? "danger"
        : ["REGISTRATION_OPEN", "PREDICTIONS_OPEN"].includes(status)
          ? "info"
          : "warning";
  return <Badge tone={tone}>{labels[status]}</Badge>;
}

export { labels as specialRoundStatusLabels };
