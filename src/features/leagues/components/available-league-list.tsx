import { CreditCard, Globe2, LockKeyhole, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { JoinAvailableLeagueButton } from "./join-available-league-button";

export type AvailableLeagueListItem = {
  championshipCountry: string;
  championshipLabel: string;
  championshipLogo: string | null;
  description: string | null;
  entryFee: number;
  entryFeeLabel: string;
  id: string;
  membersCount: number;
  name: string;
  ownerName: string;
  status: string;
  visibility: "PUBLIC" | "PRIVATE";
};

type AvailableLeagueListProps = {
  emptyDescription?: string;
  emptyTitle?: string;
  leagues: AvailableLeagueListItem[];
};

export function AvailableLeagueList({
  emptyDescription = "Nenhuma liga disponivel no momento.",
  emptyTitle = "Sem ligas disponiveis",
  leagues
}: AvailableLeagueListProps) {
  if (leagues.length === 0) {
    return <EmptyState description={emptyDescription} icon={Globe2} title={emptyTitle} />;
  }

  return (
    <div className="grid gap-3">
      {leagues.map((league) => {
        const requiresPayment = league.visibility === "PRIVATE" && league.entryFee > 0;

        return (
          <article
            className="rounded-card border border-app-border bg-app-background p-4"
            key={league.id}
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-elevated bg-cover bg-center text-[10px] font-bold text-app-foreground"
                    style={
                      league.championshipLogo
                        ? { backgroundImage: `url("${league.championshipLogo}")` }
                        : undefined
                    }
                  >
                    {league.championshipLogo ? null : league.championshipLabel.slice(0, 2)}
                  </span>
                  <h3 className="font-semibold text-app-foreground">{league.name}</h3>
                  <Badge tone={league.visibility === "PUBLIC" ? "success" : "warning"}>
                    {league.visibility === "PUBLIC" ? "PUBLICA" : "PRIVADA"}
                  </Badge>
                  {requiresPayment ? <Badge tone="info">PIX</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-app-muted">
                  {league.description || "Liga do Bolao do Lobo."}
                </p>
                <p className="mt-2 text-xs font-semibold text-brand-gold">
                  {league.championshipLabel} | {league.championshipCountry}
                </p>
                <div className="mt-3 grid gap-2 text-xs text-app-muted sm:grid-cols-3">
                  <span className="flex items-center gap-2">
                    {league.visibility === "PUBLIC" ? (
                      <Globe2 aria-hidden className="h-4 w-4 text-brand-gold" />
                    ) : (
                      <LockKeyhole aria-hidden className="h-4 w-4 text-brand-gold" />
                    )}
                    {league.visibility === "PUBLIC" ? "Entrada direta" : "Entrada por pagamento"}
                  </span>
                  <span className="flex items-center gap-2">
                    <CreditCard aria-hidden className="h-4 w-4 text-brand-gold" />
                    {league.entryFeeLabel}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users aria-hidden className="h-4 w-4 text-brand-gold" />
                    {league.membersCount} participantes
                  </span>
                </div>
                <p className="mt-2 text-xs text-app-muted">
                  Dono: {league.ownerName} | Status: {league.status}
                </p>
              </div>
              <JoinAvailableLeagueButton leagueId={league.id} requiresPayment={requiresPayment} />
            </div>
          </article>
        );
      })}
    </div>
  );
}
