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

export const dynamic = "force-dynamic";

type RoundsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RoundsPage({ searchParams }: RoundsPageProps) {
  const params = await searchParams;
  const user = await requireUser();
  const result = await getRoundsPageData(user.id, params);
  const { championships, leagues, rounds, stats } = result.data;

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
        ) : leagues.length === 0 ? (
          <Card className="wolf-card-glow">
            <CardHeader>
              <CardTitle>Entre na alcateia</CardTitle>
              <CardDescription>
                As rodadas aparecem depois que voce entra na liga do administrador.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JoinLeagueForm defaultInviteCode="BRLOBO2026" />
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
