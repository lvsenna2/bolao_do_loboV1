import { EyeOff, GitCompareArrows, Trophy } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormLoadingButton } from "@/components/ui/loading-button";
import { getGuessComparisonData } from "@/features/guesses/data/comparison-data";
import type { ComparisonGuessView } from "@/features/guesses/data/comparison-data";
import { UserAlert } from "@/features/user/components/user-alert";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

type CompareGuessesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(date));
}

function getScoreLabel(guess: ComparisonGuessView) {
  if (guess.homePrediction === null || guess.awayPrediction === null) {
    return "Sem placar";
  }

  return `${guess.homePrediction} x ${guess.awayPrediction}`;
}

function getPredictionLabel(prediction: ComparisonGuessView["prediction"]) {
  const labels = {
    AWAY: "Visitante",
    DRAW: "Empate",
    HOME: "Mandante"
  } satisfies Record<ComparisonGuessView["prediction"], string>;

  return labels[prediction];
}

export default async function CompareGuessesPage({ searchParams }: CompareGuessesPageProps) {
  const params = await searchParams;
  const user = await requireUser();
  const result = await getGuessComparisonData(user.id, params);
  const { leagues, matches, selectedLeagueId, stats } = result.data;

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

      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <span className="text-sm text-app-muted">Partidas liberadas</span>
            <strong className="text-2xl text-app-foreground">{stats.visibleMatches}</strong>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <span className="text-sm text-app-muted">Aguardando inicio</span>
            <strong className="text-2xl text-app-foreground">{stats.hiddenMatches}</strong>
          </CardContent>
        </Card>
      </div>

      {matches.length > 0 ? (
        <div className="grid gap-5">
          {matches.map((match) => (
            <Card key={match.id}>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>
                      {match.homeTeam.shortName || match.homeTeam.name} x{" "}
                      {match.awayTeam.shortName || match.awayTeam.name}
                    </CardTitle>
                    <CardDescription>
                      {match.championshipName} | {match.roundLabel} | {formatDate(match.kickoff)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{match.status}</Badge>
                    <Badge tone={match.isVisible ? "success" : "warning"}>
                      {match.isVisible ? "Comparacao liberada" : "Oculto ate iniciar"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!match.isVisible && match.hiddenGuessCount > 0 ? (
                  <div className="mb-4 flex items-center gap-2 rounded-control border border-brand-gold/30 bg-brand-gold/10 p-3 text-sm text-app-foreground">
                    <EyeOff aria-hidden className="h-4 w-4 text-brand-gold" />
                    {match.hiddenGuessCount} palpites de outros usuarios serao exibidos apos o
                    inicio da partida.
                  </div>
                ) : null}

                {match.guesses.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {match.guesses.map((guess) => (
                      <article
                        className="rounded-control border border-app-border bg-app-background p-3"
                        key={guess.id}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={guess.user.name} src={guess.user.avatarUrl} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-app-foreground">
                              {guess.user.name}
                            </p>
                            <p className="text-xs text-app-muted">@{guess.user.username}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xl font-bold text-app-foreground">
                            {getScoreLabel(guess)}
                          </span>
                          <Badge tone="info">{getPredictionLabel(guess.prediction)}</Badge>
                          {guess.joker ? <Badge tone="warning">Curinga</Badge> : null}
                          {guess.score ? (
                            <Badge tone={guess.score.totalPoints > 0 ? "success" : "neutral"}>
                              {guess.score.totalPoints} pts
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-app-muted">
                          Enviado em {formatDate(guess.submittedAt)}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    description={
                      match.ownGuess
                        ? "Seu palpite aparecera aqui quando a comparacao for liberada."
                        : "Nenhum palpite registrado para esta partida."
                    }
                    icon={Trophy}
                    title="Sem palpites visiveis"
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
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
