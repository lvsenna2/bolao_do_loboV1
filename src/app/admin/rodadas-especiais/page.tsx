import { Flame, Landmark, Plus } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getElectionRoundSummary } from "@/features/election-special-round/data";
import { AdminSpecialRoundDeleteButton } from "@/features/special-rounds/components/admin-round-delete-button";
import { SpecialRoundStatusBadge } from "@/features/special-rounds/components/status-badge";
import { getAdminSpecialRounds } from "@/features/special-rounds/data/special-round-data";
import { canDeleteSpecialRoundEntries } from "@/features/special-rounds/services/state-service";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";
import { requireAdmin } from "@/server/auth/session";
import { withShortCache } from "@/server/cache/short-cache";

export const dynamic = "force-dynamic";

const getCachedAdminSpecialRounds = withShortCache(
  "admin-special-rounds-page-data",
  getAdminSpecialRounds
);
const getCachedElectionRoundSummary = withShortCache(
  "admin-election-round-summary",
  getElectionRoundSummary
);

export default async function AdminSpecialRoundsPage() {
  await requireAdmin();
  const [rounds, election] = await Promise.all([
    getCachedAdminSpecialRounds(),
    getCachedElectionRoundSummary()
  ]);
  return (
    <PageShell
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-button border border-brand-gold/40 px-4 font-semibold text-brand-gold"
            href={"/admin/rodadas-especiais/promocional" as Route}
          >
            <Flame className="h-4 w-4" /> Nova promocao
          </Link>
          <Link
            className="inline-flex h-11 items-center gap-2 rounded-button bg-brand-gold px-4 font-semibold text-black"
            href={"/admin/rodadas-especiais/nova" as Route}
          >
            <Plus className="h-4 w-4" /> Nova rodada
          </Link>
        </div>
      }
      description="Inscricoes, mercados, apuracao e premiacao independentes das ligas."
      eyebrow="Administracao"
      title="Rodadas Especiais"
    >
      {election ? (
        <Card className="mb-6 border-brand-gold/40">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                <Landmark className="h-4 w-4" /> Módulo independente
              </p>
              <h2 className="mt-2 text-lg font-semibold">{election.name}</h2>
              <p className="text-sm text-app-muted">
                {election._count.entries} participantes pagos | Status: {election.status}
              </p>
            </div>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-button bg-brand-gold px-4 text-sm font-semibold text-black"
              href={"/admin/rodadas-especiais/eleicoes-2026" as Route}
            >
              Gerenciar eleições
            </Link>
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {rounds.map((round) => {
          const paid = round.entries.filter((entry) => entry.paymentStatus === "APPROVED");
          const collected = paid.reduce((total, entry) => total + Number(entry.amount), 0);
          const canDelete =
            round.status === "CANCELLED" || canDeleteSpecialRoundEntries(round.entries);
          return (
            <Card key={round.id}>
              <CardHeader>
                <div className="flex justify-between gap-3">
                  <CardTitle>{round.name}</CardTitle>
                  <SpecialRoundStatusBadge status={round.status} />
                </div>
              </CardHeader>
              <CardContent>
                {round.format === "PROMO_SINGLE_SELECTION" ? (
                  <p className="mb-2 inline-flex items-center gap-1.5 rounded-button bg-brand-gold px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black">
                    <Flame className="h-3 w-3" /> Promocional | odd{" "}
                    {Number(round.promoOdds ?? 0).toFixed(2)} | /rodadas-especiais/
                    {round.promoSlug}
                  </p>
                ) : null}
                <p className="text-sm text-app-muted">
                  {round.homeTeamName} x {round.awayTeamName} |{" "}
                  {formatDateTimeInSaoPaulo(round.matchStartsAt)}
                </p>
                <p className="mt-3 text-sm">
                  {paid.length} {round.format === "PROMO_SINGLE_SELECTION" ? "apostas" : "pagos"} |{" "}
                  {round._count.markets} mercados |{" "}
                  {collected.toLocaleString("pt-BR", { currency: "BRL", style: "currency" })}{" "}
                  {round.format === "PROMO_SINGLE_SELECTION" ? "apostados" : "arrecadados"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className="inline-flex h-10 items-center rounded-button border border-brand-gold/40 px-4 text-sm font-semibold text-brand-gold"
                    href={`/admin/rodadas-especiais/${round.id}` as Route}
                  >
                    Gerenciar
                  </Link>
                  {canDelete || round.status === "CANCELLED" ? (
                    <AdminSpecialRoundDeleteButton name={round.name} specialRoundId={round.id} />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
