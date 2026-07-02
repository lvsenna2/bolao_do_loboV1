import { Crown, Users } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { JoinLeagueForm } from "@/features/leagues/components/join-league-form";
import { UserAlert } from "@/features/user/components/user-alert";
import { formatCurrency, formatDate, getUserLeagues } from "@/features/user/data/user-data";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function MyLeaguesPage() {
  const sessionUser = await requireUser();
  const result = await getUserLeagues(sessionUser.id);
  const { memberships, ownedLeagues } = result.data;

  return (
    <PageShell
      description="Consulte as ligas em que voce participa e as ligas que voce organiza."
      eyebrow="Area do usuario"
      title="Minhas ligas"
    >
      <UserAlert message={result.ok ? undefined : result.message} />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Entrar em liga</CardTitle>
          <CardDescription>
            Informe o codigo recebido do administrador para participar do bolao.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JoinLeagueForm />
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users aria-hidden className="h-5 w-5 text-brand-blue" />
              Participando
            </CardTitle>
            <CardDescription>Ligas vinculadas a sua conta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {memberships.length > 0 ? (
              memberships.map((membership) => (
                <article
                  className="rounded-card border border-app-border bg-app-background p-4"
                  key={membership.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="font-semibold text-app-foreground">
                        {membership.league.name}
                      </h2>
                      <p className="mt-1 text-sm text-app-muted">{membership.league.description}</p>
                      <p className="mt-2 text-xs text-app-muted">
                        Dono: {membership.league.owner.name} | Entrada:{" "}
                        {formatCurrency(membership.league.entryFee)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{membership.role}</Badge>
                      <Badge tone={membership.status === "ACTIVE" ? "success" : "warning"}>
                        {membership.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-app-muted sm:grid-cols-3">
                    <span>{membership.league._count.members} participantes</span>
                    <span>{membership.league._count.payments} pagamentos</span>
                    <span>Entrada em {formatDate(membership.joinedAt)}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      className={buttonVariants({ size: "sm", variant: "accent" })}
                      href={`/rodadas?league=${membership.league.id}` as Route}
                    >
                      Ver partidas
                    </Link>
                    <Link
                      className={buttonVariants({ size: "sm", variant: "secondary" })}
                      href={`/ranking?league=${membership.league.id}` as Route}
                    >
                      Ranking
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState
                description="Quando voce entrar em uma liga, ela aparecera nesta lista."
                title="Nenhuma liga encontrada"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown aria-hidden className="h-5 w-5 text-brand-gold" />
              Organizando
            </CardTitle>
            <CardDescription>Ligas criadas por voce.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ownedLeagues.length > 0 ? (
              ownedLeagues.map((league) => (
                <article
                  className="rounded-card border border-app-border bg-app-background p-4"
                  key={league.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="font-semibold text-app-foreground">{league.name}</h2>
                      <p className="mt-1 text-sm text-app-muted">{league.description}</p>
                      <p className="mt-2 text-xs text-app-muted">
                        Entrada: {formatCurrency(league.entryFee)} | Visibilidade:{" "}
                        {league.visibility}
                      </p>
                      {league.inviteCode ? (
                        <p className="mt-2 text-xs font-semibold text-brand-gold">
                          Codigo: {league.inviteCode}
                        </p>
                      ) : null}
                    </div>
                    <Badge tone={league.status === "ACTIVE" ? "success" : "warning"}>
                      {league.status}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-app-muted sm:grid-cols-3">
                    <span>{league._count.members} participantes</span>
                    <span>{league._count.payments} pagamentos</span>
                    <span>Criada em {formatDate(league.createdAt)}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      className={buttonVariants({ size: "sm", variant: "accent" })}
                      href={`/rodadas?league=${league.id}` as Route}
                    >
                      Ver partidas
                    </Link>
                    <Link
                      className={buttonVariants({ size: "sm", variant: "secondary" })}
                      href={`/ranking?league=${league.id}` as Route}
                    >
                      Ranking
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState
                description="Voce ainda nao organiza ligas."
                title="Nenhuma liga organizada"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
