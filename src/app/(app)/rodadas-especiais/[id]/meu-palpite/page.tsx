import { ArrowLeft, Check, CheckCircle2, Clock3, Pencil, Trophy, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpecialRoundMatchScoreboard } from "@/features/special-rounds/components/match-scoreboard";
import { SpecialRoundStatusBadge } from "@/features/special-rounds/components/status-badge";
import { getSpecialRoundPredictionReview } from "@/features/special-rounds/data/special-round-data";
import { formatSpecialRoundAnswer } from "@/features/special-rounds/services/answer-format";
import type { SpecialRoundAnswer } from "@/features/special-rounds/types";
import { formatDateTimeInSaoPaulo, serverNow } from "@/lib/date-time";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

function currency(value: number) {
  return value.toLocaleString("pt-BR", { currency: "BRL", style: "currency" });
}

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
  const scores = new Map(entry.scores.map((item) => [item.marketId, item]));
  const rankingIsPublic = Boolean(round.rankingPublishedAt) || round.status === "FINALIZED";
  const standing = rankingIsPublic ? entry.standing : null;
  const prize = rankingIsPublic && entry.prize ? entry.prize : null;
  const showOfficialResults = rankingIsPublic && scores.size > 0;
  const matchView = {
    awayScore: round.match?.awayScore ?? null,
    awayTeamApiId: round.match?.awayTeam.apiId ?? null,
    awayTeamLogo: round.match?.awayTeam.logo ?? round.awayTeamLogo,
    awayTeamName: round.awayTeamName,
    elapsed: round.match?.elapsed ?? null,
    homeScore: round.match?.homeScore ?? null,
    homeTeamApiId: round.match?.homeTeam.apiId ?? null,
    homeTeamLogo: round.match?.homeTeam.logo ?? round.homeTeamLogo,
    homeTeamName: round.homeTeamName,
    matchStartsAt: round.matchStartsAt,
    penaltyAway: round.match?.penaltyAway ?? null,
    penaltyHome: round.match?.penaltyHome ?? null,
    status: round.match?.status ?? null
  };

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

        <SpecialRoundMatchScoreboard match={matchView} />

        {standing ? (
          <Card className="border-brand-gold/45 bg-brand-gold/5">
            <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-app-muted">Sua posicao</p>
                <p className="flex items-center gap-2 text-2xl font-bold text-brand-gold">
                  {standing.position === 1 ? <Trophy className="h-6 w-6" /> : null}
                  {standing.position ? `${standing.position}o` : "-"}
                  <span className="text-sm font-medium text-app-muted">
                    de {round._count.standings}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-app-muted">Pontos</p>
                <p className="text-2xl font-bold">{standing.totalPoints}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-app-muted">Acertos</p>
                <p className="text-2xl font-bold">
                  {standing.hits}
                  <span className="text-sm font-medium text-app-muted">
                    /{round.markets.length}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-app-muted">Premiacao</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    prize ? "text-emerald-400" : "text-app-muted"
                  )}
                >
                  {prize ? currency(Number(prize.amount)) : "Sem premio"}
                </p>
                {prize ? (
                  <p className="text-xs text-app-muted">
                    {prize.status === "PAID"
                      ? `Creditado na sua carteira em ${formatDateTimeInSaoPaulo(prize.paidAt ?? prize.updatedAt)}`
                      : "O valor cai na sua carteira assim que a apuracao for publicada."}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-brand-gold/35">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{round.name}</CardTitle>
                <p className="mt-1 text-sm text-app-muted">
                  {showOfficialResults
                    ? "Compare cada palpite com o resultado oficial da partida."
                    : "Confira abaixo tudo o que foi registrado."}
                </p>
              </div>
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {round.markets.map((market) => {
              const prediction = predictions.get(market.id);
              const score = showOfficialResults ? scores.get(market.id) : undefined;
              return (
                <div
                  className={cn(
                    "rounded-control border bg-app-elevated p-4",
                    score?.hit
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : score
                        ? "border-app-border"
                        : "border-app-border"
                  )}
                  key={market.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
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
                      {score ? `${score.points} / ${market.points} pts` : `${market.points} pts`}
                    </span>
                  </div>
                  {score ? (
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-app-border pt-3 text-sm">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 font-semibold",
                          score.hit ? "text-emerald-400" : "text-red-400"
                        )}
                      >
                        {score.hit ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        {score.hit ? "Acertou" : "Errou"}
                      </span>
                      <span className="text-app-muted">Resultado oficial:</span>
                      <strong className="text-brand-gold">
                        {market.result
                          ? formatSpecialRoundAnswer(
                              market.result.answer as SpecialRoundAnswer,
                              market.options
                            )
                          : "-"}
                      </strong>
                    </div>
                  ) : null}
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
