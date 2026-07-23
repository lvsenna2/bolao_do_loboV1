import { GitCompareArrows } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormLoadingButton } from "@/components/ui/loading-button";
import { ComparisonBoard } from "@/features/guesses/components/comparison-board";
import { getGuessComparisonData } from "@/features/guesses/data/comparison-data";
import { UserAlert } from "@/features/user/components/user-alert";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

type CompareGuessesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CompareGuessesPage({ searchParams }: CompareGuessesPageProps) {
  const params = await searchParams;
  const user = await requireUser();
  const result = await getGuessComparisonData(user.id, params);
  const { leagues, rounds, selectedLeagueId } = result.data;

  return (
    <PageShell
      description="Compare seus palpites com os participantes da mesma liga apos o inicio de cada partida."
      eyebrow="Area do usuario"
      title="Comparar palpites"
    >
      <UserAlert message={result.ok ? undefined : result.message} />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompareArrows aria-hidden className="h-5 w-5 text-brand-gold" />
            Palpites da liga
          </CardTitle>
          <CardDescription>
            Escolha uma liga ativa. Palpites dos outros jogadores ficam ocultos ate a partida
            iniciar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leagues.length > 0 ? (
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 space-y-2">
                <span className="text-sm font-medium text-app-foreground">Liga</span>
                <select
                  className="h-11 w-full rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
                  defaultValue={selectedLeagueId}
                  name="league"
                >
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))}
                </select>
              </label>
              <FormLoadingButton
                className="h-11 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
                pendingLabel="Carregando..."
              >
                Ver comparacao
              </FormLoadingButton>
            </form>
          ) : (
            <EmptyState
              description="Entre em uma liga ativa para comparar palpites."
              title="Sem ligas ativas"
            />
          )}
        </CardContent>
      </Card>

      {rounds.length > 0 ? (
        <ComparisonBoard initialRounds={rounds} />
      ) : (
        <EmptyState
          description="Nao ha partidas com palpites para a liga selecionada."
          icon={GitCompareArrows}
          title="Nada para comparar"
        />
      )}
    </PageShell>
  );
}
