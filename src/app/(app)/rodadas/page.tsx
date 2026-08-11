import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAlert } from "@/features/user/components/user-alert";
import { requireUser } from "@/server/auth/session";
import { getRoundsPageData } from "@/features/rounds/data/round-data";
import { RoundCard } from "@/features/rounds/components/round-card";
import { RoundFilterForm } from "@/features/rounds/components/round-filter-form";
import { withShortCache } from "@/server/cache/short-cache";

export const dynamic = "force-dynamic";

type RoundsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const getCachedRoundsPageData = withShortCache("rounds-page-data", getRoundsPageData);

export default async function RoundsPage({ searchParams }: RoundsPageProps) {
  const [params, user] = await Promise.all([searchParams, requireUser()]);
  const result = await getCachedRoundsPageData(user.id, params);
  const { championships, leagues, rounds, stats } = result.data;

  return (
    <PageShell
      description="Consulte rapidamente os jogos das suas ligas."
      eyebrow="Area do usuario"
      title="Rodadas"
    >
      <UserAlert message={!result.ok ? result.message : undefined} />

      <div className="flex flex-wrap gap-2">
        <Badge>{stats.totalRounds} rodadas</Badge>
        <Badge tone="success">{stats.openRounds} abertas</Badge>
        <Badge tone="info">{stats.activeRounds} ativas</Badge>
        <Badge tone="warning">{stats.remainingMatches} jogos restantes</Badge>
      </div>

      <section className="mt-5">
        <RoundFilterForm championships={championships} leagues={leagues} searchParams={params} />

        {rounds.length > 0 ? (
          <div className="grid gap-5">
            {rounds.map((round) => (
              <RoundCard key={round.id} round={round} />
            ))}
          </div>
        ) : leagues.length === 0 ? (
          <EmptyState
            action={
              <Link className={buttonVariants({ size: "sm", variant: "accent" })} href="/ligas">
                Ver ligas
              </Link>
            }
            description="Entre em uma liga para visualizar seus jogos."
            icon={CalendarDays}
            title="Nenhuma liga ativa"
          />
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
