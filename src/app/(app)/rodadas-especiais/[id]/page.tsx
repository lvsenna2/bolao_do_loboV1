import { notFound } from "next/navigation";
import { Coins, Eye, Hourglass, LockKeyhole, Trophy, Users } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JoinSpecialRound } from "@/features/special-rounds/components/join-special-round";
import type { SpecialRoundPaymentView } from "@/features/special-rounds/components/join-special-round";
import {
  isSpecialRoundMatchStarted,
  SpecialRoundMatchScoreboard
} from "@/features/special-rounds/components/match-scoreboard";
import { SpecialRoundPredictionForm } from "@/features/special-rounds/components/prediction-form";
import { SpecialRoundCountdown } from "@/features/special-rounds/components/countdown";
import { SpecialRoundStatusBadge } from "@/features/special-rounds/components/status-badge";
import { PromoRoundView } from "@/features/special-rounds/components/promo-round-view";
import {
  getPromoRoundForUser,
  getSpecialRoundDetail
} from "@/features/special-rounds/data/special-round-data";
import { isUuid } from "@/features/special-rounds/services/promo-service";
import { formatSpecialRoundAnswer } from "@/features/special-rounds/services/answer-format";
import {
  getGoalScorerOptionSide,
  getGoalScorerPlayerValue
} from "@/features/special-rounds/services/default-markets";
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

  // A URL de trafego pago usa o slug da campanha (/rodadas-especiais/flamengo-cruzeiro), entao
  // o mesmo segmento aceita uuid ou slug e a promocao ganha uma pagina propria.
  const promo = await getPromoRoundForUser(route.id, user.id);
  if (promo) return <PromoRoundView round={promo} userId={user.id} />;
  if (!isUuid(route.id)) notFound();

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
  const champion = round.standings.find((standing) => standing.position === 1) ?? null;
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
  const matchFinished = round.match?.status === "FINISHED";
  const rankingIsPublic = Boolean(round.rankingPublishedAt) || round.status === "FINALIZED";
  // O jogo acabou mas a classificacao ainda nao saiu: explique em vez de deixar a tela muda.
  const showSettlementNotice = matchFinished && !rankingIsPublic && round.status !== "CANCELLED";
  const predictionMarkets = round.markets.map((market) => ({
    answerType: market.answerType,
    description: market.description,
    id: market.id,
    kind: market.kind,
    options: market.options.map((option) => ({
      group:
        getGoalScorerOptionSide(option.value) === "HOME"
          ? round.homeTeamName
          : getGoalScorerOptionSide(option.value) === "AWAY"
            ? round.awayTeamName
            : (playerTeamByOption.get(getGoalScorerPlayerValue(option.value)) ?? null),
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
              <CardTitle>
                {isSpecialRoundMatchStarted(matchView.status) ? "Placar" : "A partida"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SpecialRoundMatchScoreboard match={matchView} />
              {showSettlementNotice ? (
                <p className="mt-3 flex items-start gap-2 rounded-control border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                  <Hourglass className="mt-0.5 h-4 w-4 shrink-0" />
                  Jogo encerrado. A apuracao roda automaticamente assim que os dados oficiais da
                  partida (gols, cartoes, escanteios) sao consolidados e a classificacao aparece
                  aqui.
                </p>
              ) : null}
            </CardContent>
          </Card>

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

          {rankingIsPublic ? (
            <Card>
              <CardHeader>
                <CardTitle>Classificacao</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {champion ? (
                  <div className="mb-4 rounded-control border border-brand-gold/45 bg-brand-gold/10 p-4">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
                      <span aria-hidden>🏆</span> Campeao da rodada
                    </p>
                    <p className="mt-1 text-lg font-semibold">{champion.entry.user.name}</p>
                    <p className="text-sm text-app-muted">
                      {champion.totalPoints} pontos | {champion.hits} acertos
                      {champion.entry.prize
                        ? ` | ${Number(champion.entry.prize.amount).toLocaleString("pt-BR", {
                            currency: "BRL",
                            style: "currency"
                          })}`
                        : ""}
                    </p>
                  </div>
                ) : null}
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
                            <strong>
                              {prediction
                                ? formatSpecialRoundAnswer(
                                    prediction.answer as SpecialRoundAnswer,
                                    market.options
                                  )
                                : "-"}
                            </strong>
                            <span className="text-xs text-app-muted">Resultado oficial</span>
                            <span className="text-right text-xs font-semibold text-brand-gold">
                              {market.result
                                ? formatSpecialRoundAnswer(
                                    market.result.answer as SpecialRoundAnswer,
                                    market.options
                                  )
                                : "-"}
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
