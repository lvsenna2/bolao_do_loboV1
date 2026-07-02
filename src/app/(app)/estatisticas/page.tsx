import { BarChart3, Medal, Target, Trophy, XCircle } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/server/auth/session";
import { UserAlert } from "@/features/user/components/user-alert";
import { UserStatCard } from "@/features/user/components/user-stat-card";
import { getUserStatistics } from "@/features/user/data/user-data";

export const dynamic = "force-dynamic";

export default async function UserStatisticsPage() {
  const sessionUser = await requireUser();
  const result = await getUserStatistics(sessionUser.id);
  const stats = result.data;

  return (
    <PageShell
      description="Indicadores pessoais calculados a partir de palpites, pontuacoes e rankings registrados."
      eyebrow="Area do usuario"
      title="Estatisticas"
    >
      <UserAlert message={result.ok ? undefined : result.message} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UserStatCard
          description="Palpites registrados"
          icon={BarChart3}
          label="Palpites"
          value={stats.guesses}
        />
        <UserStatCard
          description="Pontos acumulados"
          icon={Trophy}
          label="Pontos"
          value={stats.points}
        />
        <UserStatCard
          description={`${stats.winRate}% de aproveitamento`}
          icon={Target}
          label="Acertos"
          value={stats.winnerHits}
        />
        <UserStatCard
          description={`${stats.exactScoreRate}% dos palpites`}
          icon={Medal}
          label="Placares exatos"
          value={stats.exactScores}
        />
        <UserStatCard
          description="Palpites sem acerto de vencedor"
          icon={XCircle}
          label="Erros"
          value={stats.losses}
        />
      </section>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Historico de rankings</CardTitle>
          <CardDescription>Ultimos registros de ranking associados ao seu usuario.</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.rankings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead className="border-b border-app-border text-xs uppercase tracking-[0.08em] text-app-muted">
                  <tr>
                    <th className="px-4 py-3">Escopo</th>
                    <th className="px-4 py-3">Liga</th>
                    <th className="px-4 py-3">Posicao</th>
                    <th className="px-4 py-3">Pontos</th>
                    <th className="px-4 py-3">Exatos</th>
                    <th className="px-4 py-3">Acertos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {stats.rankings.map((ranking) => (
                    <tr key={ranking.id}>
                      <td className="px-4 py-3">{ranking.scope}</td>
                      <td className="px-4 py-3">{ranking.league?.name ?? "-"}</td>
                      <td className="px-4 py-3">{ranking.position ?? "-"}</td>
                      <td className="px-4 py-3">{ranking.points}</td>
                      <td className="px-4 py-3">{ranking.exactScores}</td>
                      <td className="px-4 py-3">{ranking.hits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              description="Historico de ranking aparecera quando houver processamento de pontuacao."
              title="Sem historico"
            />
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
