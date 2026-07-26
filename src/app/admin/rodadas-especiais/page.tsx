import { Plus } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSpecialRoundDeleteButton } from "@/features/special-rounds/components/admin-round-delete-button";
import { SpecialRoundStatusBadge } from "@/features/special-rounds/components/status-badge";
import { getAdminSpecialRounds } from "@/features/special-rounds/data/special-round-data";
import {
  canDeleteCancelledSpecialRoundEntries,
  canDeleteSpecialRoundEntries
} from "@/features/special-rounds/services/state-service";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";
import { requireAdmin } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminSpecialRoundsPage() {
  await requireAdmin();
  const rounds = await getAdminSpecialRounds();
  return (
    <PageShell
      actions={
        <Link
          className="inline-flex h-11 items-center gap-2 rounded-button bg-brand-gold px-4 font-semibold text-black"
          href={"/admin/rodadas-especiais/nova" as Route}
        >
          <Plus className="h-4 w-4" /> Nova rodada
        </Link>
      }
      description="Inscricoes, mercados, apuracao e premiacao independentes das ligas."
      eyebrow="Administracao"
      title="Rodadas Especiais"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {rounds.map((round) => {
          const paid = round.entries.filter((entry) => entry.paymentStatus === "APPROVED");
          const collected = paid.reduce((total, entry) => total + Number(entry.amount), 0);
          const canDelete =
            round.status === "CANCELLED"
              ? canDeleteCancelledSpecialRoundEntries(round.entries)
              : canDeleteSpecialRoundEntries(round.entries);
          return (
            <Card key={round.id}>
              <CardHeader>
                <div className="flex justify-between gap-3">
                  <CardTitle>{round.name}</CardTitle>
                  <SpecialRoundStatusBadge status={round.status} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-app-muted">
                  {round.homeTeamName} x {round.awayTeamName} |{" "}
                  {formatDateTimeInSaoPaulo(round.matchStartsAt)}
                </p>
                <p className="mt-3 text-sm">
                  {paid.length} pagos | {round._count.markets} mercados |{" "}
                  {collected.toLocaleString("pt-BR", { currency: "BRL", style: "currency" })}{" "}
                  arrecadados
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
