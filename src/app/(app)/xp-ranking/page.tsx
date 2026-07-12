import { Medal, Sparkles, Target, Trophy } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormLoadingButton } from "@/components/ui/loading-button";
import { UserAlert } from "@/features/user/components/user-alert";
import { UserStatCard } from "@/features/user/components/user-stat-card";
import { getXpRankingData } from "@/features/xp/data/xp-ranking-data";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

type XpRankingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function XpRankingPage({ searchParams }: XpRankingPageProps) {
  const params = await searchParams;
  const user = await requireUser();
  const result = await getXpRankingData(user.id, params);
  const { filters, leagues, rows, seasons, stats } = result.data;

  return (
    <PageShell
      description="Acompanhe a progressao permanente dos participantes, separada da pontuacao do bolao."
      eyebrow="Progressao"
      title="Ranking de XP"
    >
      <UserAlert message={!result.ok ? result.message : undefined} />

      <div className="grid gap-4 md:grid-cols-3">
        <UserStatCard
          description="Participantes no filtro"
          icon={Sparkles}
          label="Ranking XP"
          value={stats.rows}
        />
        <UserStatCard
          description="XP do lider"
          icon={Trophy}
          label="Lider"
          value={stats.leaderXp}
        />
        <UserStatCard
          description="Sua posicao no filtro atual"
          icon={Target}
          label="Minha posicao"
          value={stats.myPosition ?? "-"}
        />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Escolha se quer ver XP global, por liga ou por temporada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 lg:grid-cols-4 lg:items-end">
            <label className="space-y-2">
              <span className="text-sm font-medium text-app-foreground">Tipo</span>
              <select
                className="h-10 w-full rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                defaultValue={filters.scope}
                name="scope"
              >
                <option value="global">Global</option>
                <option value="league">Liga</option>
                <option value="season">Temporada</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-app-foreground">Liga</span>
              <select
                className="h-10 w-full rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                defaultValue={filters.leagueId}
                name="league"
              >
                <option value="">Selecione</option>
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-app-foreground">Temporada</span>
              <select
                className="h-10 w-full rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                defaultValue={filters.seasonId}
                name="season"
              >
                <option value="">Selecione</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.label}
                  </option>
                ))}
              </select>
            </label>
            <FormLoadingButton
              className="h-10 rounded-button bg-brand-gold px-4 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
              pendingLabel="Carregando..."
            >
              Aplicar
            </FormLoadingButton>
          </form>
        </CardContent>
      </Card>

      <section className="mt-5">
        {rows.length > 0 ? (
          <div className="overflow-hidden rounded-card border border-app-border bg-app-surface">
            {rows.map((row) => (
              <article
                className="flex flex-col gap-3 border-b border-app-border p-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
                key={row.user.id}
              >
                <div className="flex items-center gap-3">
                  <Badge tone={row.position === 1 ? "warning" : "neutral"}>#{row.position}</Badge>
                  <Avatar alt={row.user.name} name={row.user.name} src={row.user.avatarUrl} />
                  <div>
                    <p className="font-semibold text-app-foreground">{row.user.name}</p>
                    <p className="text-xs text-app-muted">@{row.user.username}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">
                    {row.level.medal} {row.level.name}
                  </Badge>
                  <Badge tone={row.level.discountPercent > 0 ? "success" : "neutral"}>
                    {row.level.discountPercent}% desconto
                  </Badge>
                  <span className="text-lg font-bold text-brand-gold">{row.xp} XP</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description="Quando houver XP registrado, os participantes aparecerao aqui."
            icon={Medal}
            title="Ranking de XP vazio"
          />
        )}
      </section>
    </PageShell>
  );
}
