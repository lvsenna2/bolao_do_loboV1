import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RankingOption, RankingPageData } from "../data/ranking-data";

type RankingFilterFormProps = {
  filters: RankingPageData["filters"];
  leagues: RankingOption[];
};

const selectClass =
  "h-10 rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

export function RankingFilterForm({ filters, leagues }: RankingFilterFormProps) {
  return (
    <form className="mb-5 grid gap-3 rounded-card border border-app-border bg-app-surface p-4 md:grid-cols-[1fr_auto] md:items-end">
      <label className="space-y-2">
        <span className="text-sm font-medium text-app-foreground">Liga</span>
        <select className={selectClass} defaultValue={filters.leagueId} name="league">
          <option value="">Selecione uma liga</option>
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.label}
            </option>
          ))}
        </select>
      </label>

      <Button disabled={leagues.length === 0} type="submit" variant="secondary">
        <Filter aria-hidden className="h-4 w-4" />
        Filtrar
      </Button>
    </form>
  );
}
