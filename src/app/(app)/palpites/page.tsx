import { CalendarCheck2 } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AvailableLeagueList } from "@/features/leagues/components/available-league-list";
import { JoinLeagueForm } from "@/features/leagues/components/join-league-form";
import { GuessesBoard } from "@/features/guesses/components/guesses-board";
import { getGuessesPageData } from "@/features/guesses/data/guess-data";
import { UserAlert } from "@/features/user/components/user-alert";
import { formatCurrency, getUserLeagues } from "@/features/user/data/user-data";
import { requireUser } from "@/server/auth/session";

function getChampionshipLabel(championship: {
  name: string;
  seasons: Array<{
    name: string | null;
    year: number;
  }>;
}) {
  const season = championship.seasons[0];

  return `${championship.name}${season ? ` ${season.name || season.year}` : ""}`;
}

export default async function GuessesPage() {
  const user = await requireUser();
  const [result, leaguesResult] = await Promise.all([
    getGuessesPageData(user.id),
    getUserLeagues(user.id)
  ]);
  const hasActiveLeague = leaguesResult.data.memberships.some(
    (membership) => membership.status === "ACTIVE"
  );
  const availableLeagueItems = leaguesResult.data.availableLeagues.map((league) => ({
    championshipCountry: league.championship.country,
    championshipLabel: getChampionshipLabel(league.championship),
    championshipLogo: league.championship.logo,
    description: league.description,
    entryFee: Number(league.entryFee),
    entryFeeLabel: formatCurrency(league.entryFee),
    id: league.id,
    membersCount: league._count.members,
    name: league.name,
    ownerName: league.owner.name,
    status: league.status,
    visibility: league.visibility === "PRIVATE" ? ("PRIVATE" as const) : ("PUBLIC" as const)
  }));

  return (
    <PageShell
      description="Acompanhe o que falta, revise os palpites salvos e escolha o Coringa de cada rodada."
      eyebrow="Area do usuario"
      title="Palpites"
    >
      <UserAlert message={!result.ok ? result.message : undefined} />

      {result.data.rounds.length > 0 ? (
        <GuessesBoard initialRounds={result.data.rounds} />
      ) : !hasActiveLeague && availableLeagueItems.length > 0 ? (
        <Card className="wolf-card-glow">
          <CardHeader>
            <CardTitle>Ligas disponiveis</CardTitle>
            <CardDescription>
              Entre em uma liga para liberar as rodadas abertas para palpite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AvailableLeagueList leagues={availableLeagueItems} />
          </CardContent>
        </Card>
      ) : !hasActiveLeague ? (
        <Card className="wolf-card-glow">
          <CardHeader>
            <CardTitle>Entre em uma liga</CardTitle>
            <CardDescription>
              Para liberar rodadas e palpites, entre em uma liga criada pelo administrador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JoinLeagueForm />
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          description="Nenhuma rodada disponivel para palpites no momento."
          icon={CalendarCheck2}
          title="Sem rodadas abertas"
        />
      )}
    </PageShell>
  );
}
