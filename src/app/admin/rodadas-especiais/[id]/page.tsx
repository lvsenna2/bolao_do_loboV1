import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { AdminPromoRoundSummary } from "@/features/special-rounds/components/admin-promo-round-summary";
import { AdminSpecialRoundWorkspace } from "@/features/special-rounds/components/admin-round-workspace";
import { SpecialRoundStatusBadge } from "@/features/special-rounds/components/status-badge";
import { getAdminSpecialRoundDetail } from "@/features/special-rounds/data/special-round-data";
import { requireAdmin } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminSpecialRoundDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const round = await getAdminSpecialRoundDetail(id);
  if (!round) notFound();
  return (
    <PageShell
      actions={
        <>
          <SpecialRoundStatusBadge status={round.status} />
          <Link
            className="inline-flex h-10 items-center rounded-button border border-app-border px-3 text-sm"
            href={`/admin/rodadas-especiais/${round.id}/editar` as Route}
          >
            Editar
          </Link>
        </>
      }
      description={`${round.homeTeamName} x ${round.awayTeamName}`}
      eyebrow="Administracao"
      title={round.name}
    >
      {round.format === "PROMO_SINGLE_SELECTION" ? (
        <AdminPromoRoundSummary
          entries={round.entries.map((entry) => ({
            amount: Number(entry.amount),
            bonusAmount: Number(entry.bonusAmount),
            paymentStatus: entry.paymentStatus
          }))}
          maxStakeCents={round.promoMaxStakeCents ?? 0}
          odds={Number(round.promoOdds ?? 0)}
          selectionLabel={round.promoSelectionLabel ?? ""}
          slug={round.promoSlug ?? ""}
        />
      ) : null}
      <AdminSpecialRoundWorkspace
        entries={round.entries.map((entry) => ({
          blockedAt: entry.blockedAt,
          id: entry.id,
          paymentStatus: entry.paymentStatus,
          predictions: entry.predictions,
          prize: entry.prize
            ? { amount: Number(entry.prize.amount), id: entry.prize.id, status: entry.prize.status }
            : null,
          standing: entry.standing ? { manualTieBreak: entry.standing.manualTieBreak } : null,
          user: entry.user
        }))}
        markets={round.markets.map((market) => ({
          ...market,
          line: market.line ? Number(market.line) : null
        }))}
        specialRoundId={round.id}
        standings={round.standings.map((standing) => ({
          entry: {
            prize: standing.entry.prize
              ? {
                  amount: Number(standing.entry.prize.amount),
                  status: standing.entry.prize.status
                }
              : null,
            user: { name: standing.entry.user.name }
          },
          exactScoreHits: standing.exactScoreHits,
          hits: standing.hits,
          id: standing.id,
          position: standing.position,
          totalPoints: standing.totalPoints
        }))}
        status={round.status}
      />
    </PageShell>
  );
}
