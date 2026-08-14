import { Landmark, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { getElectionRoundSummary } from "@/features/election-special-round/data";
import { getSpecialRoundsForUser } from "@/features/special-rounds/data/special-round-data";
import { PromoRoundCard } from "@/features/special-rounds/components/promo-round-card";
import { SpecialRoundCard } from "@/features/special-rounds/components/special-round-card";
import {
  isPromoBettingOpen,
  promoMaxStakeCents,
  promoSelectionText
} from "@/features/special-rounds/services/promo-service";
import { requireUser } from "@/server/auth/session";
import { canCreateSpecialRound } from "@/features/subscriptions/service";
import { serverNow } from "@/lib/date-time";
import { withShortCache } from "@/server/cache/short-cache";

export const dynamic = "force-dynamic";

const getCachedElectionRoundSummary = withShortCache(
  "special-round-election-summary",
  getElectionRoundSummary
);
const getCachedCanCreateSpecialRound = withShortCache(
  "special-round-can-create",
  canCreateSpecialRound
);

export default async function SpecialRoundsPage() {
  const user = await requireUser();
  const [rounds, election, canCreate] = await Promise.all([
    getSpecialRoundsForUser(user.id),
    getCachedElectionRoundSummary(),
    getCachedCanCreateSpecialRound(user.id)
  ]);
  const now = serverNow();
  // Rodadas encerradas continuam na aba por 48h para que o campeao fique visivel a todos.
  const visibleSince = new Date(now.getTime() - 48 * 60 * 60_000);
  const isRecentlyClosed = (round: (typeof rounds)[number]) => {
    if (!["FINALIZED", "CANCELLED"].includes(round.status)) return false;
    return (round.finalizedAt ?? round.cancelledAt ?? round.updatedAt) >= visibleSince;
  };

  // A promocao vem antes de tudo: e a oferta anunciada no trafego pago e precisa ser a
  // primeira coisa que o usuario ve ao cair na aba. Ela tem card proprio, entao sai das
  // listas de rodadas comuns em qualquer status.
  const promos = rounds
    .filter(
      (round) =>
        round.format === "PROMO_SINGLE_SELECTION" &&
        (!["FINALIZED", "CANCELLED"].includes(round.status) || isRecentlyClosed(round))
    )
    .map((round) => ({
      bettingOpen: isPromoBettingOpen({
        closesAt: round.registrationClosesAt,
        matchStatus: round.match?.status,
        now,
        opensAt: round.registrationOpensAt,
        status: round.status
      }),
      round
    }))
    .sort((left, right) => Number(right.bettingOpen) - Number(left.bettingOpen));
  const isStandard = (round: (typeof rounds)[number]) => round.format !== "PROMO_SINGLE_SELECTION";
  const active = rounds.filter(
    (round) => isStandard(round) && !["FINALIZED", "CANCELLED"].includes(round.status)
  );
  const closed = rounds.filter((round) => isStandard(round) && isRecentlyClosed(round));

  return (
    <PageShell
      description="Disputas independentes com inscricao, mercados e premiacao proprios."
      eyebrow="Competicao especial"
      title="Rodadas Especiais"
    >
      {canCreate ? (
        <div className="mb-6 flex justify-end">
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-button bg-brand-gold px-5 font-semibold text-black"
            href={"/rodadas-especiais/nova" as Route}
          >
            <Plus className="h-4 w-4" /> Criar Rodada Especial
          </Link>
        </div>
      ) : null}
      {promos.length ? (
        <section className="mb-8 space-y-5">
          {promos.map(({ bettingOpen, round }) => (
            <PromoRoundCard
              awayTeamApiId={round.match?.awayTeam.apiId}
              awayTeamLogo={round.awayTeamLogo}
              awayTeamName={round.awayTeamName}
              bettingOpen={bettingOpen}
              headline={round.promoHeadline}
              homeTeamApiId={round.match?.homeTeam.apiId}
              homeTeamLogo={round.homeTeamLogo}
              homeTeamName={round.homeTeamName}
              href={`/rodadas-especiais/${round.promoSlug ?? round.id}`}
              key={round.id}
              matchStartsAt={round.matchStartsAt}
              matchStatus={round.match?.status}
              maxStakeCents={promoMaxStakeCents(round)}
              odds={Number(round.promoOdds ?? 0)}
              selectionLabel={promoSelectionText(round)}
              userStakedCents={
                round.userEntry?.paymentStatus === "APPROVED"
                  ? Math.round(Number(round.userEntry.amount) * 100)
                  : 0
              }
            />
          ))}
        </section>
      ) : null}
      {election && election.status !== "CANCELLED" ? (
        <Card className="mb-8 overflow-hidden border-brand-gold/40 bg-black text-white">
          <CardContent className="relative p-5 sm:p-6">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(242,185,28,0.22),transparent_36%)]"
            />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                  <Landmark className="h-4 w-4" /> Evento temporário
                </p>
                <h2 className="mt-2 text-xl font-semibold">{election.name}</h2>
                <p className="mt-1 text-sm text-white/65">
                  R$ 10,00 por inscrição | {election._count.entries} participantes
                </p>
              </div>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-button bg-brand-gold px-5 font-semibold text-black"
                href={"/rodadas-especiais/eleicoes-2026" as Route}
              >
                Abrir rodada
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}
      {active.length ? (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Abertas e futuras</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {active.map((round) => (
              <SpecialRoundCard
                awayScore={round.match?.awayScore}
                awayTeamApiId={round.match?.awayTeam.apiId}
                awayTeamLogo={round.awayTeamLogo}
                awayTeamName={round.awayTeamName}
                champion={round.champion}
                elapsed={round.match?.elapsed}
                entryFee={Number(round.entryFee)}
                estimatedPrize={round.estimatedPrize}
                homeScore={round.match?.homeScore}
                homeTeamApiId={round.match?.homeTeam.apiId}
                homeTeamLogo={round.homeTeamLogo}
                homeTeamName={round.homeTeamName}
                id={round.id}
                key={round.id}
                matchStartsAt={round.matchStartsAt}
                matchStatus={round.match?.status}
                name={round.name}
                participants={round._count.entries}
                status={round.status}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-card border border-dashed border-app-border p-8 text-center text-app-muted">
          Nenhuma rodada especial disponivel no momento.
        </div>
      )}
      {closed.length ? (
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Encerradas</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {closed.slice(0, 6).map((round) => (
              <SpecialRoundCard
                awayScore={round.match?.awayScore}
                awayTeamApiId={round.match?.awayTeam.apiId}
                awayTeamLogo={round.awayTeamLogo}
                awayTeamName={round.awayTeamName}
                champion={round.champion}
                elapsed={round.match?.elapsed}
                entryFee={Number(round.entryFee)}
                estimatedPrize={round.estimatedPrize}
                homeScore={round.match?.homeScore}
                homeTeamApiId={round.match?.homeTeam.apiId}
                homeTeamLogo={round.homeTeamLogo}
                homeTeamName={round.homeTeamName}
                id={round.id}
                key={round.id}
                matchStartsAt={round.matchStartsAt}
                matchStatus={round.match?.status}
                name={round.name}
                participants={round._count.entries}
                status={round.status}
              />
            ))}
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
