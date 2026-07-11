import { Medal, Target, Trophy, UsersRound } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { RankingFilterForm } from "@/features/ranking/components/ranking-filter-form";
import { RankingTable } from "@/features/ranking/components/ranking-table";
import { getRankingPageData } from "@/features/ranking/data/ranking-data";
import { UserAlert } from "@/features/user/components/user-alert";
import { UserStatCard } from "@/features/user/components/user-stat-card";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

type RankingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RankingPage({ searchParams }: RankingPageProps) {
  const params = await searchParams;
  const user = await requireUser();
  const result = await getRankingPageData(user.id, params);
  const { filters, leagues, myRanking, rankings, stats } = result.data;

  return (
    <PageShell
      description="Selecione uma liga para ver a classificacao independente dela."
      eyebrow="Area do usuario"
      title="Ranking"
    >
      <UserAlert message={!result.ok ? result.message : undefined} />

      <div className="grid gap-4 md:grid-cols-3">
        <UserStatCard
          description="Participantes listados"
          icon={UsersRound}
          label="Ranking"
          value={stats.rows}
        />
        <UserStatCard
          description="Pontuacao do lider"
          icon={Trophy}
          label="Lider"
          value={stats.leaderPoints}
        />
        <UserStatCard
          description="Sua posicao no filtro atual"
          icon={Target}
          label="Minha posicao"
          value={stats.myPosition ?? "-"}
        />
      </div>

      <section className="mt-8">
        <RankingFilterForm filters={filters} leagues={leagues} />

        {rankings.length > 0 ? (
          <RankingTable myRanking={myRanking} rankings={rankings} />
        ) : (
          <EmptyState
            description={
              leagues.length === 0
                ? "Voce ainda nao participou de nenhuma liga."
                : "O ranking desta liga ainda nao possui pontuacao processada."
            }
            icon={Medal}
            title="Ranking vazio"
          />
        )}
      </section>
    </PageShell>
  );
}
