import { Award, Lock } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/server/auth/session";
import { UserAlert } from "@/features/user/components/user-alert";
import { formatDate, getUserAchievements } from "@/features/user/data/user-data";
import { LeagueEmblem } from "@/features/xp/components/league-emblem";

export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const sessionUser = await requireUser();
  const result = await getUserAchievements(sessionUser.id);
  const { achieved, leagueAwards, locked } = result.data;

  return (
    <PageShell
      description="Acompanhe badges, medalhas e conquistas desbloqueadas."
      eyebrow="Area do usuario"
      title="Conquistas"
    >
      <UserAlert message={result.ok ? undefined : result.message} />

      <Card className="mb-5 border-brand-gold/30">
        <CardHeader>
          <CardTitle>Emblemas de liga</CardTitle>
          <CardDescription>
            Premiacoes oficiais concedidas pelo desempenho em suas ligas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leagueAwards.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {leagueAwards.map((award) => (
                <article
                  className="rounded-card border border-brand-gold/35 bg-brand-gold/5 p-4"
                  key={award.id}
                >
                  <div className="flex items-start gap-3">
                    <div>
                      <LeagueEmblem emblem={award} />
                      <p className="mt-2 text-sm text-app-muted">{award.reason}</p>
                      <p className="mt-3 text-xs text-app-muted">
                        Concedido em {formatDate(award.createdAt)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Quando voce for premiado em uma liga, o emblema aparecera aqui."
              title="Nenhum emblema de liga ainda"
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Desbloqueadas</CardTitle>
            <CardDescription>{achieved.length} conquistas no seu perfil.</CardDescription>
          </CardHeader>
          <CardContent>
            {achieved.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {achieved.map((achievement) => (
                  <article
                    className="rounded-card border border-app-border bg-app-background p-4"
                    key={achievement.id}
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
                        <Award aria-hidden className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-app-foreground">
                            {achievement.badge.title}
                          </h2>
                          <Badge>{achievement.badge.rarity}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-app-muted">
                          {achievement.badge.description}
                        </p>
                        <p className="mt-3 text-xs text-app-muted">
                          Desbloqueada em {formatDate(achievement.unlockedAt)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                description="Conquistas desbloqueadas aparecerao aqui."
                title="Nenhuma conquista desbloqueada"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Disponiveis</CardTitle>
            <CardDescription>Badges ainda nao desbloqueadas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {locked.length > 0 ? (
              locked.map((badge) => (
                <article
                  className="rounded-card border border-app-border bg-app-background p-4 opacity-80"
                  key={badge.id}
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-elevated text-app-muted">
                      <Lock aria-hidden className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-app-foreground">{badge.title}</h2>
                        <Badge>{badge.rarity}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-app-muted">{badge.description}</p>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-app-muted">Nenhuma badge pendente.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
