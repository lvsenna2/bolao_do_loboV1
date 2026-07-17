/* eslint-disable @next/next/no-img-element */
import type { Route } from "next";
import Link from "next/link";
import {
  Award,
  Bell,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Medal,
  Target,
  Trophy,
  Users,
  XCircle
} from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getTeamLogoSrc } from "@/lib/team-logo";
import { cn } from "@/lib/utils";
import { getMatchStatusLabel, getRoundStatusLabel } from "@/features/rounds/data/round-data";
import { UserAlert } from "@/features/user/components/user-alert";
import { UserStatCard } from "@/features/user/components/user-stat-card";
import { XpProgress } from "@/features/user/components/xp-progress";
import { formatDate, getUserHomeData } from "@/features/user/data/user-data";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function TeamMark({
  apiId,
  logo,
  name,
  shortName
}: {
  apiId: number | null;
  logo: string | null;
  name: string;
  shortName: string | null;
}) {
  const logoSrc = getTeamLogoSrc({ apiId, logo });

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        aria-label={name}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-elevated bg-contain bg-center bg-no-repeat text-xs font-bold text-app-foreground"
        role="img"
      >
        {logoSrc ? (
          <img
            alt=""
            className="h-7 w-7 object-contain"
            referrerPolicy="no-referrer"
            src={logoSrc}
          />
        ) : (
          getInitials(shortName || name)
        )}
      </span>
      <span className="truncate text-sm font-semibold text-app-foreground">
        {shortName || name}
      </span>
    </span>
  );
}

export default async function UserHomePage() {
  const sessionUser = await requireUser();
  const result = await getUserHomeData(sessionUser.id);
  const {
    achievements,
    currentRound,
    leagueRanking,
    memberships,
    notifications,
    recentGuesses,
    stats,
    todayMatches,
    user,
    xpProgress
  } = result.data;

  const remainingRoundMatches =
    currentRound?.matches.filter((match) =>
      ["SCHEDULED", "LIVE", "HALFTIME", "POSTPONED", "SUSPENDED"].includes(match.status)
    ).length ?? 0;
  const leader = leagueRanking[0];

  return (
    <PageShell
      actions={
        <>
          <Link
            className={buttonVariants({ size: "sm", variant: "accent" })}
            href={"/palpites" as Route}
          >
            Palpitar
          </Link>
          <Link
            className={buttonVariants({ size: "sm", variant: "secondary" })}
            href={"/rodadas" as Route}
          >
            Rodadas
          </Link>
        </>
      }
      description="Acompanhe suas ligas, partidas abertas, palpites, ranking, estatisticas e notificacoes."
      eyebrow="Area do usuario"
      title="Dashboard"
    >
      <UserAlert message={result.ok ? undefined : result.message} />

      {user ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16" name={user.name} src={user.avatarUrl} />
                <div>
                  <p className="text-xl font-bold text-app-foreground">{user.name}</p>
                  <p className="text-sm text-app-muted">@{user.username}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="info">
                      {xpProgress
                        ? `${xpProgress.currentLevel.medal} ${xpProgress.currentLevel.name}`
                        : "Patente indisponivel"}
                    </Badge>
                    <Badge tone="warning">{user.xp} XP</Badge>
                    <Badge tone={stats.myLeaguePosition ? "success" : "neutral"}>
                      Posicao #{stats.myLeaguePosition ?? "-"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid gap-2 text-sm text-app-muted sm:grid-cols-2 lg:text-right">
                <p>Criado em {formatDate(user.createdAt)}</p>
                <p>Ultimo login {formatDate(user.lastLoginAt)}</p>
              </div>
            </CardContent>
          </Card>

          {memberships.length === 0 ? (
            <EmptyState
              action={
                <Link className={buttonVariants({ size: "sm", variant: "accent" })} href="/ligas">
                  Ver ligas
                </Link>
              }
              description="Voce ainda nao participou de nenhuma liga."
              icon={Users}
              title="Nenhuma liga ativa"
            />
          ) : null}

          <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <UserStatCard
              description="Pontuacao acumulada"
              icon={Trophy}
              label="Pontos"
              value={stats.points}
            />
            <UserStatCard
              description="Palpites registrados"
              icon={ClipboardList}
              label="Palpites"
              value={stats.guesses}
            />
            <UserStatCard
              description="Vencedores acertados"
              icon={Medal}
              label="Acertos"
              value={stats.winnerHits}
            />
            <UserStatCard
              description="Placares exatos"
              icon={Award}
              label="Exatos"
              value={stats.exactScores}
            />
            <UserStatCard
              description="Aproveitamento"
              icon={Target}
              label="Win rate"
              value={`${stats.winRate}%`}
            />
            <UserStatCard
              description="Nao lidas"
              icon={Bell}
              label="Notificacoes"
              value={stats.unreadNotifications}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Resumo da rodada</CardTitle>
                      <CardDescription>Prazo, status e progresso da rodada atual.</CardDescription>
                    </div>
                    <Link
                      className={buttonVariants({ size: "sm", variant: "secondary" })}
                      href={"/rodadas" as Route}
                    >
                      Ver rodadas
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {currentRound ? (
                    <div className="grid gap-4 lg:grid-cols-[1fr_160px_160px_180px]">
                      <div className="rounded-control border border-app-border bg-app-background p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-gold">
                          {currentRound.season.championship.name}
                        </p>
                        <p className="mt-2 text-xl font-bold text-app-foreground">
                          {currentRound.name || `Rodada ${currentRound.number}`}
                        </p>
                        <p className="mt-1 text-sm text-app-muted">
                          {currentRound.season.name || currentRound.season.year}
                        </p>
                      </div>
                      <div className="rounded-control bg-app-background p-4">
                        <p className="text-xs text-app-muted">Jogos</p>
                        <p className="mt-1 text-2xl font-bold text-app-foreground">
                          {currentRound.matches.length}
                        </p>
                      </div>
                      <div className="rounded-control bg-app-background p-4">
                        <p className="text-xs text-app-muted">Restantes</p>
                        <p className="mt-1 text-2xl font-bold text-app-foreground">
                          {remainingRoundMatches}
                        </p>
                      </div>
                      <div className="rounded-control bg-app-background p-4">
                        <p className="text-xs text-app-muted">Prazo</p>
                        <p className="mt-1 text-sm font-semibold text-app-foreground">
                          {formatDate(currentRound.endsAt)}
                        </p>
                        <Badge
                          className="mt-2"
                          tone={currentRound.status === "OPEN" ? "success" : "info"}
                        >
                          {getRoundStatusLabel(currentRound.status)}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      description="Nenhuma rodada ativa ou agendada foi encontrada."
                      icon={CalendarDays}
                      title="Sem rodada atual"
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Proximas partidas</CardTitle>
                      <CardDescription>
                        Partidas abertas para palpite nas suas ligas ativas.
                      </CardDescription>
                    </div>
                    <Link
                      className={buttonVariants({ size: "sm", variant: "secondary" })}
                      href={"/palpites" as Route}
                    >
                      Abrir palpites
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {todayMatches.length > 0 ? (
                    todayMatches.map((match) => (
                      <div
                        className="grid gap-3 rounded-control border border-app-border bg-app-background p-3 lg:grid-cols-[1fr_auto_1fr_auto] lg:items-center"
                        key={match.id}
                      >
                        <TeamMark {...match.homeTeam} />
                        <span className="text-center text-sm font-bold text-app-muted">x</span>
                        <TeamMark {...match.awayTeam} />
                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <Badge tone={match.guesses.length > 0 ? "success" : "info"}>
                            {match.guesses.length > 0 ? "Confirmado" : "Pendente"}
                          </Badge>
                          <Badge>{getMatchStatusLabel(match.status)}</Badge>
                        </div>
                        <p className="flex items-center gap-2 text-xs text-app-muted lg:col-span-4">
                          <CalendarClock aria-hidden className="h-4 w-4 text-brand-gold" />
                          {formatDate(match.kickoff)} - {match.round.season.championship.name}
                        </p>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      description="Nenhuma partida disponivel para palpite."
                      icon={CalendarClock}
                      title="Sem partidas abertas"
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Meus palpites</CardTitle>
                      <CardDescription>
                        Ultimos palpites enviados e pontos quando homologados.
                      </CardDescription>
                    </div>
                    <Link
                      className={buttonVariants({ size: "sm", variant: "secondary" })}
                      href={"/palpites" as Route}
                    >
                      Ver todos
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentGuesses.length > 0 ? (
                    recentGuesses.map((guess) => {
                      const score =
                        guess.homePrediction === null || guess.awayPrediction === null
                          ? "-"
                          : `${guess.homePrediction} x ${guess.awayPrediction}`;

                      return (
                        <div
                          className="flex flex-col gap-3 rounded-control border border-app-border bg-app-background p-3 sm:flex-row sm:items-center sm:justify-between"
                          key={guess.id}
                        >
                          <div>
                            <p className="font-semibold text-app-foreground">
                              {guess.match.homeTeam.shortName || guess.match.homeTeam.name} x{" "}
                              {guess.match.awayTeam.shortName || guess.match.awayTeam.name}
                            </p>
                            <p className="text-xs text-app-muted">
                              {guess.match.round.season.championship.name} -{" "}
                              {guess.match.round.name || `Rodada ${guess.match.round.number}`}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <Badge tone="info">{score}</Badge>
                            {guess.joker ? <Badge tone="warning">Curinga</Badge> : null}
                            {guess.score ? (
                              <Badge tone={guess.score.totalPoints > 0 ? "success" : "neutral"}>
                                {guess.score.totalPoints} pts
                              </Badge>
                            ) : (
                              <Badge>{getMatchStatusLabel(guess.match.status)}</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <EmptyState
                      description="Voce ainda nao realizou palpites."
                      icon={ClipboardList}
                      title="Nenhum palpite"
                    />
                  )}
                </CardContent>
              </Card>
            </div>

            <aside className="space-y-6">
              <XpProgress progress={xpProgress} xp={user.xp} />

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Ranking da liga</CardTitle>
                      <CardDescription>Top 10 da sua liga ativa mais recente.</CardDescription>
                    </div>
                    <Link
                      className={buttonVariants({ size: "sm", variant: "secondary" })}
                      href={"/ranking" as Route}
                    >
                      Abrir
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {leader ? (
                    <div className="rounded-control border border-brand-gold/30 bg-brand-gold/10 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-gold">
                        Lider
                      </p>
                      <p className="mt-1 font-semibold text-app-foreground">{leader.user.name}</p>
                      <p className="text-sm text-app-muted">{leader.points} pontos</p>
                    </div>
                  ) : null}
                  {leagueRanking.length > 0 ? (
                    leagueRanking.slice(0, 10).map((ranking) => (
                      <div className="flex items-center justify-between gap-3" key={ranking.id}>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={ranking.user.name} src={ranking.user.avatarUrl} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-app-foreground">
                              {ranking.user.name}
                            </p>
                            <p className="text-xs text-app-muted">{ranking.exactScores} exatos</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge tone={ranking.position === 1 ? "warning" : "neutral"}>
                            #{ranking.position ?? "-"}
                          </Badge>
                          <p className="mt-1 text-sm font-semibold text-app-foreground">
                            {ranking.points}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      description="O ranking ainda nao possui participantes."
                      icon={Trophy}
                      title="Ranking vazio"
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Estatisticas</CardTitle>
                  <CardDescription>Indicadores rapidos do seu desempenho.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="flex items-center justify-between rounded-control bg-app-background p-3">
                    <span className="flex items-center gap-2 text-sm text-app-muted">
                      <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-500" />
                      Acertos
                    </span>
                    <strong className="text-app-foreground">{stats.winnerHits}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-control bg-app-background p-3">
                    <span className="flex items-center gap-2 text-sm text-app-muted">
                      <XCircle aria-hidden className="h-4 w-4 text-red-500" />
                      Erros
                    </span>
                    <strong className="text-app-foreground">{stats.losses}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-control bg-app-background p-3">
                    <span className="flex items-center gap-2 text-sm text-app-muted">
                      <Award aria-hidden className="h-4 w-4 text-brand-gold" />
                      Conquistas
                    </span>
                    <strong className="text-app-foreground">{achievements.length}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-control bg-app-background p-3">
                    <span className="flex items-center gap-2 text-sm text-app-muted">
                      <Users aria-hidden className="h-4 w-4 text-brand-gold" />
                      Ligas
                    </span>
                    <strong className="text-app-foreground">{stats.leagues}</strong>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Notificacoes</CardTitle>
                      <CardDescription>Ultimos avisos recebidos.</CardDescription>
                    </div>
                    <Link
                      className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}
                      href={"/notificacoes" as Route}
                    >
                      Abrir
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <div
                        className="rounded-control border border-app-border bg-app-background p-3"
                        key={notification.id}
                      >
                        <p className="font-medium text-app-foreground">{notification.title}</p>
                        <p className="mt-1 text-sm text-app-muted">
                          {notification.message ?? notification.body}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-app-muted">Nenhuma notificacao por enquanto.</p>
                  )}
                </CardContent>
              </Card>
            </aside>
          </section>
        </div>
      ) : (
        <EmptyState
          description="Nao foi possivel localizar os dados da sua conta."
          title="Dashboard indisponivel"
        />
      )}
    </PageShell>
  );
}
