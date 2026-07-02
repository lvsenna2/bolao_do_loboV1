import { CalendarCheck2, CircleGauge, Wand2 } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/session";
import { UserAlert } from "@/features/user/components/user-alert";
import { UserStatCard } from "@/features/user/components/user-stat-card";
import { getGuessesPageData } from "@/features/guesses/data/guess-data";
import { GuessHistoryCard } from "@/features/guesses/components/guess-history-card";
import { GuessMatchCard } from "@/features/guesses/components/guess-match-card";
import { JoinLeagueForm } from "@/features/leagues/components/join-league-form";
import { getUserLeagues } from "@/features/user/data/user-data";

export default async function GuessesPage() {
  const user = await requireUser();
  const [result, leaguesResult] = await Promise.all([
    getGuessesPageData(user.id),
    getUserLeagues(user.id)
  ]);
  const { availableMatches, recentGuesses, stats } = result.data;
  const hasActiveLeague = leaguesResult.data.memberships.some(
    (membership) => membership.status === "ACTIVE"
  );

  return (
    <PageShell
      description="Registre, altere ou exclua palpites enquanto a rodada estiver aberta e a partida ainda nao tiver iniciado."
      eyebrow="Area do usuario"
      title="Palpites"
    >
      <UserAlert message={!result.ok ? result.message : undefined} />

      <div className="grid gap-4 md:grid-cols-3">
        <UserStatCard
          description="Jogos com prazo aberto"
          icon={CalendarCheck2}
          label="Disponiveis"
          value={stats.availableMatches}
        />
        <UserStatCard
          description="Palpites registrados"
          icon={CircleGauge}
          label="Enviados"
          value={stats.submittedGuesses}
        />
        <UserStatCard
          description="Uso total registrado"
          icon={Wand2}
          label="Curingas"
          value={stats.usedJokers}
        />
      </div>

      <section className="mt-8 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-app-foreground">Jogos abertos</h2>
          <p className="mt-1 text-sm text-app-muted">Cada partida aceita um palpite por usuario.</p>
        </div>

        {availableMatches.length > 0 ? (
          <div className="grid gap-5 xl:grid-cols-2">
            {availableMatches.map((match) => (
              <GuessMatchCard key={match.id} match={match} />
            ))}
          </div>
        ) : !hasActiveLeague ? (
          <Card className="wolf-card-glow">
            <CardHeader>
              <CardTitle>Entre no Bolao Brasileirao</CardTitle>
              <CardDescription>
                Para liberar rodadas e palpites, entre na liga criada pelo administrador.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JoinLeagueForm defaultInviteCode="BRLOBO2026" />
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            description="Nenhuma partida esta com rodada aberta e horario valido para palpite neste momento."
            icon={CalendarCheck2}
            title="Sem jogos abertos"
          />
        )}
      </section>

      <section className="mt-8 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-app-foreground">Meus palpites</h2>
          <p className="mt-1 text-sm text-app-muted">
            Ultimos palpites enviados e respectivos status de edicao.
          </p>
        </div>

        {recentGuesses.length > 0 ? (
          <div className="grid gap-4">
            {recentGuesses.map((guess) => (
              <GuessHistoryCard key={guess.guess.id} guess={guess} />
            ))}
          </div>
        ) : (
          <EmptyState
            description="Seus palpites enviados aparecerao aqui assim que voce registrar o primeiro."
            icon={CircleGauge}
            title="Nenhum palpite enviado"
          />
        )}
      </section>
    </PageShell>
  );
}
