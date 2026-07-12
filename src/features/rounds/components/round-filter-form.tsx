import { Filter } from "lucide-react";
import { RoundStatus } from "@prisma/client";

import { FormLoadingButton } from "@/components/ui/loading-button";
import type { RoundFilterOption } from "../data/round-data";
import { getRoundStatusLabel } from "../data/round-data";

type RoundFilterFormProps = {
  championships: RoundFilterOption[];
  leagues: RoundFilterOption[];
  searchParams: Record<string, string | string[] | undefined>;
};

const selectClass =
  "h-10 rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

function getParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? value[0] : value;
}

export function RoundFilterForm({ championships, leagues, searchParams }: RoundFilterFormProps) {
  return (
    <form className="mb-5 flex flex-col gap-3 rounded-card border border-app-border bg-app-surface p-4 sm:flex-row sm:items-end">
      <label className="space-y-2">
        <span className="text-sm font-medium text-app-foreground">Liga</span>
        <select
          className={selectClass}
          defaultValue={getParam(searchParams, "league") ?? ""}
          name="league"
        >
          <option value="">Todas</option>
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-2">
        <span className="text-sm font-medium text-app-foreground">Campeonato</span>
        <select
          className={selectClass}
          defaultValue={getParam(searchParams, "championship") ?? ""}
          name="championship"
        >
          <option value="">Todos</option>
          {championships.map((championship) => (
            <option key={championship.id} value={championship.id}>
              {championship.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-2">
        <span className="text-sm font-medium text-app-foreground">Status</span>
        <select
          className={selectClass}
          defaultValue={getParam(searchParams, "status") ?? ""}
          name="status"
        >
          <option value="">Todos</option>
          {Object.values(RoundStatus).map((status) => (
            <option key={status} value={status}>
              {getRoundStatusLabel(status)}
            </option>
          ))}
        </select>
      </label>
      <FormLoadingButton
        className="inline-flex h-10 items-center justify-center gap-2 rounded-button border border-app-border bg-app-surface px-4 text-sm font-semibold text-app-foreground transition hover:border-brand-blue hover:text-brand-blue"
        pendingLabel="Carregando..."
        type="submit"
      >
        <Filter aria-hidden className="h-4 w-4" />
        Filtrar
      </FormLoadingButton>
    </form>
  );
}
