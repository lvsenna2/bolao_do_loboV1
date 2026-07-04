import { Crown, KeyRound, Users } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { Prisma } from "@prisma/client";

import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AvailableLeagueList } from "@/features/leagues/components/available-league-list";
import { JoinLeagueForm } from "@/features/leagues/components/join-league-form";
import { PixPaymentCard } from "@/features/payments/components/pix-payment-card";
import { createQrSvgDataUri, getPixReceiverKey } from "@/features/payments/pix";
import { UserAlert } from "@/features/user/components/user-alert";
import { formatCurrency, formatDate, getUserLeagues } from "@/features/user/data/user-data";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  return typeof value === "number" ? value : (value?.toNumber() ?? 0);
}

export default async function LeaguesPage() {
  const sessionUser = await requireUser();
  const result = await getUserLeagues(sessionUser.id);
  const { availableLeagues, memberships, ownedLeagues } = result.data;
  const availableLeagueItems = availableLeagues.map((league) => ({
    description: league.description,
    entryFee: toNumber(league.entryFee),
    entryFeeLabel: formatCurrency(league.entryFee),
    id: league.id,
    membersCount: league._count.members,
    name: league.name,
    ownerName: league.owner.name,
    status: league.status,
    visibility: league.visibility === "PRIVATE" ? ("PRIVATE" as const) : ("PUBLIC" as const)
  }));

  return (
    <PageShell
      description="Veja as ligas disponiveis, entre nas publicas direto e pague o Pix das privadas."
      eyebrow="Area do usuario"
      title="Ligas"
    >
      <UserAlert message={result.ok ? undefined : result.message} />

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users aria-hidden className="h-5 w-5 text-brand-gold" />
              Ligas disponiveis
            </CardTitle>
            <CardDescription>
              Publicas entram na hora. Privadas geram pagamento Pix e liberam apos aprovacao.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AvailableLeagueList leagues={availableLeagueItems} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound aria-hidden className="h-5 w-5 text-brand-gold" />
              Codigo de convite
            </CardTitle>
            <CardDescription>
              Use somente para ligas que o administrador decidiu esconder da lista.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JoinLeagueForm />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Minhas ligas</CardTitle>
          <CardDescription>Ligas ativas e pagamentos pendentes ficam aqui.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {memberships.length > 0 ? (
            memberships.map((membership) => {
              const pendingPixPayment = membership.league.payments[0];

              return (
                <article
                  className="rounded-card border border-app-border bg-app-background p-4"
                  key={membership.id}
                >
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                    <div>
                      <h2 className="font-semibold text-app-foreground">
                        {membership.league.name}
                      </h2>
                      <p className="mt-1 text-sm text-app-muted">
                        {membership.league.description || "Liga do Bolao do Lobo."}
                      </p>
                      <p className="mt-2 text-xs text-app-muted">
                        Dono: {membership.league.owner.name} | Entrada:{" "}
                        {formatCurrency(membership.league.entryFee)} | Desde{" "}
                        {formatDate(membership.joinedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{membership.role}</Badge>
                      <Badge tone={membership.status === "ACTIVE" ? "success" : "warning"}>
                        {membership.status}
                      </Badge>
                    </div>
                  </div>

                  {membership.status === "PENDING_PAYMENT" && pendingPixPayment?.qrCode ? (
                    <div className="mt-4">
                      <PixPaymentCard
                        amountLabel={formatCurrency(pendingPixPayment.amount)}
                        leagueName={membership.league.name}
                        pixCode={pendingPixPayment.qrCode}
                        pixKey={getPixReceiverKey()}
                        qrCodeDataUri={createQrSvgDataUri(pendingPixPayment.qrCode)}
                        transactionId={pendingPixPayment.transactionId ?? "PENDENTE"}
                      />
                    </div>
                  ) : null}

                  {membership.status === "ACTIVE" ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        className={buttonVariants({ size: "sm", variant: "accent" })}
                        href={`/rodadas?league=${membership.league.id}` as Route}
                      >
                        Jogos
                      </Link>
                      <Link
                        className={buttonVariants({ size: "sm", variant: "secondary" })}
                        href={`/ranking?league=${membership.league.id}` as Route}
                      >
                        Ranking
                      </Link>
                    </div>
                  ) : (
                    <p className="mt-4 rounded-control border border-brand-gold/30 bg-brand-gold/10 p-3 text-sm font-medium text-app-foreground">
                      Acesso liberado apos aprovacao do pagamento.
                    </p>
                  )}
                </article>
              );
            })
          ) : (
            <EmptyState
              description="Entre em uma liga disponivel para liberar rodadas e palpites."
              title="Voce ainda nao entrou em ligas"
            />
          )}
        </CardContent>
      </Card>

      {ownedLeagues.length > 0 ? (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown aria-hidden className="h-5 w-5 text-brand-gold" />
              Organizando
            </CardTitle>
            <CardDescription>Ligas criadas por voce.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {ownedLeagues.map((league) => (
              <article
                className="rounded-card border border-app-border bg-app-background p-4"
                key={league.id}
              >
                <h2 className="font-semibold text-app-foreground">{league.name}</h2>
                <p className="mt-1 text-sm text-app-muted">
                  Entrada: {formatCurrency(league.entryFee)} | {league.visibility}
                </p>
                {league.inviteCode ? (
                  <p className="mt-2 text-xs font-semibold text-brand-gold">
                    Codigo: {league.inviteCode}
                  </p>
                ) : null}
              </article>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </PageShell>
  );
}
