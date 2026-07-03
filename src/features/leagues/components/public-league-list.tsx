import { Globe2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { JoinPublicLeagueButton } from "./join-public-league-button";

export type PublicLeagueListItem = {
  description: string | null;
  entryFeeLabel: string;
  id: string;
  membersCount: number;
  name: string;
  ownerName: string;
  status: string;
};

type PublicLeagueListProps = {
  emptyDescription?: string;
  emptyTitle?: string;
  leagues: PublicLeagueListItem[];
};

export function PublicLeagueList({
  emptyDescription = "Nenhuma liga publica disponivel no momento.",
  emptyTitle = "Sem ligas publicas",
  leagues
}: PublicLeagueListProps) {
  if (leagues.length === 0) {
    return <EmptyState description={emptyDescription} icon={Globe2} title={emptyTitle} />;
  }

  return (
    <div className="grid gap-3">
      {leagues.map((league) => (
        <article
          className="rounded-card border border-app-border bg-app-background p-4"
          key={league.id}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-app-foreground">{league.name}</h3>
                <Badge tone="success">PUBLICA</Badge>
              </div>
              <p className="mt-1 text-sm text-app-muted">
                {league.description || "Liga publica do Bolao do Lobo."}
              </p>
              <p className="mt-2 text-xs text-app-muted">
                Dono: {league.ownerName} | Entrada: {league.entryFeeLabel} | Status:{" "}
                {league.status}
              </p>
            </div>
            <JoinPublicLeagueButton leagueId={league.id} />
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-app-muted">
            <Users aria-hidden className="h-4 w-4" />
            <span>{league.membersCount} participantes</span>
          </div>
        </article>
      ))}
    </div>
  );
}
