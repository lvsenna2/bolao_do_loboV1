import { ArrowLeft, CheckCircle2, Clock3, Pencil } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpecialRoundStatusBadge } from "@/features/special-rounds/components/status-badge";
import { getSpecialRoundPredictionReview } from "@/features/special-rounds/data/special-round-data";
import { formatSpecialRoundAnswer } from "@/features/special-rounds/services/answer-format";
import type { SpecialRoundAnswer } from "@/features/special-rounds/types";
import { formatDateTimeInSaoPaulo, serverNow } from "@/lib/date-time";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function SpecialRoundPredictionReviewPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const [user, route] = await Promise.all([requireUser(), params]);
  const entry = await getSpecialRoundPredictionReview(route.id, user.id);
  if (!entry) notFound();

  const round = entry.specialRound;
  const now = serverNow();
  const canEdit =
    entry.paymentStatus === "APPROVED" &&
    !entry.blockedAt &&
    round.status === "PREDICTIONS_OPEN" &&
    now >= round.predictionsOpenAt &&
    now < round.predictionsCloseAt &&
    now < round.matchStartsAt;
  const predictions = new Map(entry.predictions.map((item) => [item.marketId, item]));

  return (
    <PageShell
      actions={<SpecialRoundStatusBadge status={round.status} />}
      description={`${round.homeTeamName} x ${round.awayTeamName} | ${formatDateTimeInSaoPaulo(round.matchStartsAt)}`}
      eyebrow="Rodada Especial"
      title="Meu palpite"
    >
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-button border border-app-border px-3 text-sm font-medium"
            href={`/rodadas-especiais/${round.id}` as Route}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para a rodada
          </Link>
          {canEdit ? (
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-semibold text-black"
              href={`/rodadas-especiais/${round.id}` as Route}
            >
              <Pencil className="h-4 w-4" />
              Editar palpites
            </Link>
          ) : null}
        </div>

        <Card className="border-brand-gold/35">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{round.name}</CardTitle>
                <p className="mt-1 text-sm text-app-muted">
                  Confira abaixo tudo o que foi registrado.
                </p>
              </div>
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {round.markets.map((market) => {
              const prediction = predictions.get(market.id);
              return (
                <div
                  className="rounded-control border border-app-border bg-app-elevated p-4"
                  key={market.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-app-muted">{market.title}</p>
                      <p className="mt-1 text-lg font-semibold text-app-foreground">
                        {prediction
                          ? formatSpecialRoundAnswer(
                              prediction.answer as SpecialRoundAnswer,
                              market.options
                            )
                          : "Nao informado"}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-brand-gold">
                      {market.points} pts
                    </span>
                  </div>
                  {prediction ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-app-muted">
                      <Clock3 className="h-3.5 w-3.5" />
                      Salvo em {formatDateTimeInSaoPaulo(prediction.updatedAt)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
