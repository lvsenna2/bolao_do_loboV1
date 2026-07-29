import { notFound } from "next/navigation";
import { Coins, Eye, LockKeyhole, Trophy, Users } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JoinSpecialRound } from "@/features/special-rounds/components/join-special-round";
import type { SpecialRoundPaymentView } from "@/features/special-rounds/components/join-special-round";
import { SpecialRoundPredictionForm } from "@/features/special-rounds/components/prediction-form";
import { SpecialRoundCountdown } from "@/features/special-rounds/components/countdown";
import { SpecialRoundStatusBadge } from "@/features/special-rounds/components/status-badge";
import { getSpecialRoundDetail } from "@/features/special-rounds/data/special-round-data";
import type { SpecialRoundAnswer } from "@/features/special-rounds/types";
import { formatDateTimeInSaoPaulo, serverNow } from "@/lib/date-time";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function SpecialRoundDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const [user, route] = await Promise.all([requireUser(), params]);
  const round = await getSpecialRoundDetail(route.id, user.id);
  if (!round) notFound();
  const now = serverNow();
  const entry = round.entries.find((item) => item.userId === user.id);
  const predictionsOpen =
    entry?.paymentStatus === "APPROVED" &&
    !entry.blockedAt &&
    round.status === "PREDICTIONS_OPEN" &&
    now >= round.predictionsOpenAt &&
    now < round.predictionsCloseAt &&
    now < round.matchStartsAt;
  const initialAnswers = Object.fromEntries(
    (entry?.predictions ?? []).map((prediction) => [
      prediction.marketId,
      prediction.answer as SpecialRoundAnswer
    ])
  );
  const paidParticipants = round._count.entries;
  const pendingPayment: SpecialRoundPaymentView | null =
    entry?.paymentStatus === "PENDING" && entry.qrCode && entry.qrCodeBase64 && entry.transactionId
      ? {
          amountLabel: Number(entry.amount).toLocaleString("pt-BR", {
            currency: "BRL",
            style: "currency"
          }),
          expiresAtLabel: entry.paymentExpiresAt
            ? formatDateTimeInSaoPaulo(entry.paymentExpiresAt)
            : undefined,
          paymentId: entry.id,
          pixCode: entry.qrCode,
          qrCodeDataUri: `data:image/png;base64,${entry.qrCodeBase64}`,
          ticketUrl: entry.ticketUrl,
          transactionId: entry.transactionId
        }
      : null;
  const estimatedPrize =
    round.prizeMode === "FIXED"
      ? Number(round.fixedPrize ?? 0)
      : paidParticipants * Number(round.entryFee) * (Number(round.prizePoolPercent) / 100);
  const playerTeamByOption = new Map<string, string>(
    (round.match?.lineups ?? []).flatMap((lineup) =>
      lineup.players.map((item) => [`PLAYER:${item.playerId}`, lineup.team.name] as const)
    )
  );
  const predictionMarkets = round.markets.map((market) => ({
    answerType: market.answerType,
    description: market.description,
    id: market.id,
    kind: market.kind,
    options: market.options.map((option) => ({
      group: playerTeamByOption.get(option.value) ?? null,
      label: option.label,
      value: option.value
    })),
    points: market.points,
    required: market.required,
    title: market.title
  }));

  return (
    <PageShell
      actions={<SpecialRoundStatusBadge status={round.status} />}
      description={`${round.homeTeamName} x ${round.awayTeamName} | ${formatDateTimeInSaoPaulo(round.matchStartsAt)}`}
      eyebrow="Rodada Especial"
      title={round.name}
    >
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="space-y-6">
          <Card className="border-brand-gold/30">
            <CardHeader>
              <CardTitle>Mercados da rodada</CardTitle>
            </CardHeader>
            <CardContent>
              {predictionsOpen ? (
                <SpecialRoundPredictionForm
                  awayTeamName={round.awayTeamName}
                  homeTeamName={round.homeTeamName}
                  initialAnswers={initialAnswers}
                  markets={predictionMarkets}
                  specialRoundId={round.id}
                />
              ) : (
                <div className="flex items-start gap-3 rounded-control border border-app-border bg-app-elevated p-4 text-sm text-app-muted">
                  <LockKeyhole className="h-5 w-5 text-brand-gold" />
                  <p>
                    {!entry
                      ? "Confirme sua inscricao para acessar os palpites."
                      : entry.paymentStatus !== "APPROVED"
                        ? "Aguardando confirmacao do pagamento."
                        : "Os palpites ainda nao abriram ou ja foram encerrados."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {round.rankingPublishedAt || round.status === "FINALIZED" ? (
            <Card>
              <CardHeader>
                <CardTitle>Classificacao</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {round.standings.length ? (
                  round.standings.map((standing) => (
                    <div
                      className="flex items-center gap-3 rounded-control border border-app-border p-3"
                      key={standing.id}
                    >
                      <strong className="w-8 text-brand-gold">#{standing.position}</strong>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{standing.entry.user.name}</p>
                        <p className="text-xs text-app-muted">{standing.hits} acertos</p>
                      </div>
                      <strong>{standing.totalPoints} pts</strong>
                      {standing.entry.prize ? (
                        <span className="text-sm text-emerald-400">
                          {Number(standing.entry.prize.amount).toLocaleString("pt-BR", {
                            currency: "BRL",
                            style: "currency"
                          })}
                        </span>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-app-muted">Classificacao ainda nao publicada.</p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {now >= round.predictionsCloseAt || now >= round.matchStartsAt ? (
            <Card>
              <CardHeader>
                <CardTitle>Palpites dos participantes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {round.entries.map((participant) => (
                  <details
                    className="rounded-control border border-app-border p-3"
                    key={participant.id}
                  >
                    <summary className="cursor-pointer font-semibold">
                      {participant.user.name}
                    </summary>
                    <div className="mt-3 space-y-2 text-sm">
                      {round.markets.map((market) => {
                        const prediction = participant.predictions.find(
                          (item) => item.marketId === market.id
                        );
                        return (
                          <div className="grid grid-cols-[1fr_auto] gap-x-3" key={market.id}>
                            <span className="text-app-muted">{market.title}</span>
                            <strong>{prediction ? JSON.stringify(prediction.answer) : "-"}</strong>
                            <span className="text-xs text-app-muted">Resultado oficial</span>
                            <span className="text-right text-xs font-semibold text-brand-gold">
                              {market.result ? JSON.stringify(market.result.answer) : "-"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </main>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-gold" /> {paidParticipants} participantes pagos
              </p>
              <p className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-brand-gold" /> Entrada:{" "}
                {Number(round.entryFee).toLocaleString("pt-BR", {
                  currency: "BRL",
                  style: "currency"
                })}
              </p>
              <p className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-brand-gold" /> Premio estimado:{" "}
                {estimatedPrize.toLocaleString("pt-BR", { currency: "BRL", style: "currency" })}
              </p>
              <p>Palpites fecham em {formatDateTimeInSaoPaulo(round.predictionsCloseAt)}</p>
              <SpecialRoundCountdown closesAt={round.predictionsCloseAt.toISOString()} />
            </CardContent>
          </Card>
          {(!entry || entry.paymentStatus === "PENDING") &&
          ["REGISTRATION_OPEN", "PREDICTIONS_OPEN"].includes(round.status) ? (
            <JoinSpecialRound
              initialPayment={pendingPayment}
              name={round.name}
              specialRoundId={round.id}
            />
          ) : null}
          {entry?.predictions.length ? (
            <Link
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-button border border-brand-gold/40 bg-brand-gold/10 px-4 font-semibold text-brand-gold"
              href={`/rodadas-especiais/${round.id}/meu-palpite` as Route}
            >
              <Eye className="h-4 w-4" />
              Visualizar meu palpite
            </Link>
          ) : null}
          {round.rules ? (
            <Card>
              <CardHeader>
                <CardTitle>Regulamento</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-app-muted">{round.rules}</p>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </PageShell>
  );
}
