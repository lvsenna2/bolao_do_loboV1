import { CalendarDays, CircleGauge, ListChecks, Trophy } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAlert } from "@/features/user/components/user-alert";
import { UserStatCard } from "@/features/user/components/user-stat-card";
import { requireUser } from "@/server/auth/session";
import { getRoundsPageData } from "@/features/rounds/data/round-data";
import { RoundCard } from "@/features/rounds/components/round-card";
import { RoundFilterForm } from "@/features/rounds/components/round-filter-form";
import { JoinLeagueForm } from "@/features/leagues/components/join-league-form";
import { AvailableLeagueList } from "@/features/leagues/components/available-league-list";
import { formatCurrency, getUserLeagues } from "@/features/user/data/user-data";

export const dynamic = "force-dynamic";

type RoundsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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

export default async function RoundsPage({ searchParams }: RoundsPageProps) {
  const params = await searchParams;
  const user = await requireUser();
  const [result, leaguesResult] = await Promise.all([
    getRoundsPageData(user.id, params),
    getUserLeagues(user.id)
  ]);
  const { championships, leagues, rounds, stats } = result.data;
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
      description="Acompanhe rodadas, jogos, prazos de envio e o status dos seus palpites."
      eyebrow="Area do usuario"
      title="Rodadas"
    >
      <UserAlert message={!result.ok ? result.message : undefined} />

      <div className="grid gap-4 md:grid-cols-4">
        <UserStatCard
          description="Rodadas listadas"
          icon={CalendarDays}
          label="Rodadas"
          value={stats.totalRounds}
        />
        <UserStatCard
          description="Abertas para palpite"
          icon={Trophy}
          label="Abertas"
          value={stats.openRounds}
        />
        <UserStatCard
          description="Em andamento ou abertas"
          icon={CircleGauge}
          label="Ativas"
          value={stats.activeRounds}
        />
        <UserStatCard
          description="Jogos ainda pendentes"
          icon={ListChecks}
          label="Restantes"
          value={stats.remainingMatches}
        />
      </div>

      <section className="mt-8">
        <RoundFilterForm championships={championships} leagues={leagues} searchParams={params} />

        {rounds.length > 0 ? (
          <div className="grid gap-5">
            {rounds.map((round) => (
              <RoundCard key={round.id} round={round} />
            ))}
          </div>
        ) : leagues.length === 0 && availableLeagueItems.length > 0 ? (
          <Card className="wolf-card-glow">
            <CardHeader>
              <CardTitle>Ligas disponiveis</CardTitle>
              <CardDescription>
                Entre em uma liga para liberar as rodadas vinculadas a ela.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AvailableLeagueList leagues={availableLeagueItems} />
            </CardContent>
          </Card>
        ) : leagues.length === 0 ? (
          <Card className="wolf-card-glow">
            <CardHeader>
              <CardTitle>Entre na alcateia</CardTitle>
              <CardDescription>
                As rodadas aparecem depois que voce entra na liga do administrador.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JoinLeagueForm />
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            description="Nenhuma rodada encontrada para os filtros selecionados."
            icon={CalendarDays}
            title="Sem rodadas"
          />
        )}
      </section>
    </PageShell>
  );
}
