import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getRankingScopeLabel,
  type RankingOption,
  type RankingPageData,
  type RankingScopeOption
} from "../data/ranking-data";

type RankingFilterFormProps = {
  filters: RankingPageData["filters"];
  leagues: RankingOption[];
  rounds: RankingOption[];
  seasons: RankingOption[];
};

const scopeOptions = ["GLOBAL", "LEAGUE", "ROUND", "SEASON", "MONTHLY", "HISTORICAL"] as const;
const selectClass =
  "h-10 rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

export function RankingFilterForm({ filters, leagues, rounds, seasons }: RankingFilterFormProps) {
  return (
    <form className="mb-5 grid gap-3 rounded-card border border-app-border bg-app-surface p-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
      <label className="space-y-2">
        <span className="text-sm font-medium text-app-foreground">Ranking</span>
        <select className={selectClass} defaultValue={filters.scope} name="scope">
          {scopeOptions.map((scope) => (
            <option key={scope} value={scope}>
              {getRankingScopeLabel(scope as RankingScopeOption)}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-app-foreground">Liga</span>
        <select className={selectClass} defaultValue={filters.leagueId} name="league">
          <option value="">Selecione</option>
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-app-foreground">Rodada</span>
        <select className={selectClass} defaultValue={filters.roundId} name="round">
          <option value="">Selecione</option>
          {rounds.map((round) => (
            <option key={round.id} value={round.id}>
              {round.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-sm font-medium text-app-foreground">Temporada</span>
        <select className={selectClass} defaultValue={filters.seasonId} name="season">
          <option value="">Selecione</option>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.label}
            </option>
          ))}
        </select>
      </label>

      <Button type="submit" variant="secondary">
        <Filter aria-hidden className="h-4 w-4" />
        Filtrar
      </Button>
    </form>
  );
}
