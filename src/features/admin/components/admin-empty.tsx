import { ClipboardList } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

type AdminEmptyProps = {
  description?: string;
  title?: string;
};

export function AdminEmpty({
  description = "Nenhum registro encontrado para os filtros atuais.",
  title = "Sem registros"
}: AdminEmptyProps) {
  return <EmptyState description={description} icon={ClipboardList} title={title} />;
}
