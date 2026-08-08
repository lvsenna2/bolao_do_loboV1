import type { Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, ClipboardList, Trophy, Users } from "lucide-react";

import { FootballLogo } from "@/components/football/football-logo";
import { PageShell } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LiveMatchesCard } from "@/features/matches/components/live-matches-card";
import { getLiveMatches } from "@/features/matches/data/live-matches-data";
import { getMatchStatusLabel, getRoundStatusLabel } from "@/features/rounds/data/round-data";
import { UserAlert } from "@/features/user/components/user-alert";
import { UserStatCard } from "@/features/user/components/user-stat-card";
import { XpProgress } from "@/features/user/components/xp-progress";
import {
  formatDate,
  getUserDashboardIdentity,
  getUserHomeData
} from "@/features/user/data/user-data";
import { requireUser } from "@/server/auth/session";
import { DashboardProfileLoading, DashboardSectionsLoading } from "./loading";

export const dynamic = "force-dynamic";

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
  return (
    <span className="flex min-w-0 items-center gap-2">
      <FootballLogo apiId={apiId} kind="team" logo={logo} name={shortName || name} size={32} />
      <span className="truncate text-sm font-semibold text-app-foreground">
        {shortName || name}
      </span>
    </span>
  );
}

async function DashboardProfileContent({ userId }: { userId: string }) {
  const { user, xpProgress } = await getUserDashboardIdentity(userId);

  if (!user) {
    return (
      <EmptyState
        description="Nao foi possivel localizar os dados da sua conta."
        title="Dashboard indisponivel"
      />
    );
  }

  return (
    <Card className="mb-5">
      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
        <Avatar
          className="h-14 w-14"
          name={user.name}
          priority
          src={user.avatarUrl}
          userId={user.id}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-app-foreground">{user.name}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge tone="info">
              {xpProgress
                ? `${xpProgress.currentLevel.medal} ${xpProgress.currentLevel.name}`
                : "Patente indisponivel"}
            </Badge>
            <Badge tone="warning">{user.xp} XP</Badge>
          </div>
        </div>
        <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href="/perfil">
          Perfil
        </Link>
      </CardContent>
    </Card>
  );
}

async function DashboardLiveContent() {
  const matches = await getLiveMatches();

  if (matches.length === 0) return null;

  return <LiveMatchesCard matches={matches} />;
}

async function DashboardDataContent({ userId }: { userId: string }) {
  const result = await getUserHomeData(userId, { mode: "light" });
  const { currentRound, memberships, stats, user, xpProgress } = result.data;

  return (
    <>
      <UserAlert message={result.ok ? undefined : result.message} />
      {user ? (
        <div className="space-y-5">
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

          <section className="grid gap-3 sm:grid-cols-3">
            <UserStatCard
              description="Pontuacao acumulada"
              icon={Trophy}
              label="Pontos"
              value={stats.points}
            />
            <UserStatCard
              description="Total registrado"
              icon={ClipboardList}
              label="Palpites"
              value={stats.guesses}
            />
            <UserStatCard
              description="Na liga mais recente"
              icon={Users}
              label="Minha posicao"
              value={stats.myLeaguePosition ? `#${stats.myLeaguePosition}` : "-"}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <Card>
                <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle>Rodada atual</CardTitle>
                    <CardDescription>Prazo e jogos disponiveis.</CardDescription>
                  </div>
                  <Link
                    className={buttonVariants({ size: "sm", variant: "secondary" })}
                    href="/rodadas"
                  >
                    Abrir
                  </Link>
                </CardHeader>
                <CardContent>
                  {currentRound ? (
                    <div className="flex flex-col gap-3 rounded-control border border-app-border bg-app-background p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase text-brand-gold">
                          {currentRound.season.championship.name}
                        </p>
                        <p className="mt-1 font-bold text-app-foreground">
                          {currentRound.name || `Rodada ${currentRound.number}`}
                        </p>
                        <p className="text-sm text-app-muted">
                          Prazo: {formatDate(currentRound.endsAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>{currentRound.matches.length} jogos</Badge>
                        <Badge tone={currentRound.status === "OPEN" ? "success" : "info"}>
                          {getRoundStatusLabel(currentRound.status)}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      description="Nenhuma rodada ativa ou agendada."
                      title="Sem rodada atual"
                    />
                  )}
                </CardContent>
              </Card>

              <Suspense fallback={<Card><CardContent className="p-4"><p className="text-sm text-app-muted">Carregando proximos palpites...</p></CardContent></Card>}>
                <DashboardMatchesContent userId={userId} />
              </Suspense>
            </div>

            <aside>
              <XpProgress progress={xpProgress} xp={user.xp} />
            </aside>
          </section>
        </div>
      ) : (
        <EmptyState
          description="Nao foi possivel carregar os dados da sua conta."
          title="Dashboard indisponivel"
        />
      )}
    </>
  );
}

async function DashboardMatchesContent({ userId }: { userId: string }) {
  const result = await getUserHomeData(userId, { mode: "full" });
  const { todayMatches } = result.data;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Proximos palpites</CardTitle>
          <CardDescription>Partidas abertas mais proximas.</CardDescription>
        </div>
        <Link className={buttonVariants({ size: "sm", variant: "accent" })} href="/palpites">
          Palpitar
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {todayMatches.length > 0 ? (
          todayMatches.map((match) => (
            <div className="rounded-control border border-app-border bg-app-background p-3" key={match.id}>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <TeamMark {...match.homeTeam} />
                <span className="text-sm font-bold text-app-muted">x</span>
                <TeamMark {...match.awayTeam} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-app-muted">
                <span className="flex items-center gap-1.5">
                  <CalendarClock aria-hidden className="h-4 w-4 text-brand-gold" />
                  {formatDate(match.kickoff)}
                </span>
                <div className="flex gap-2">
                  <Badge tone={match.guesses.length > 0 ? "success" : "warning"}>
                    {match.guesses.length > 0 ? "Salvo" : "Pendente"}
                  </Badge>
                  <Badge>{getMatchStatusLabel(match.status)}</Badge>
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState description="Nenhuma partida disponivel para palpite." title="Tudo em dia" />
        )}
      </CardContent>
    </Card>
  );
}

export default async function UserHomePage() {
  const sessionUser = await requireUser();

  return (
    <PageShell
      actions={
        <Link
          className={buttonVariants({ size: "sm", variant: "accent" })}
          href={"/palpites" as Route}
        >
          Palpitar
        </Link>
      }
      description="Veja rapidamente sua rodada, proximos palpites, XP e posicao."
      eyebrow="Area do usuario"
      title="Dashboard"
    >
      <Suspense fallback={<DashboardProfileLoading />}>
        <DashboardProfileContent userId={sessionUser.id} />
      </Suspense>
      <Suspense fallback={null}>
        <DashboardLiveContent />
      </Suspense>
      <Suspense fallback={<DashboardSectionsLoading />}>
        <DashboardDataContent userId={sessionUser.id} />
      </Suspense>
    </PageShell>
  );
}
