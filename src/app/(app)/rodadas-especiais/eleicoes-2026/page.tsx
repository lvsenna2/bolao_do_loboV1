import { notFound } from "next/navigation";
import { CalendarClock, Landmark, Trophy, Users } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ElectionPredictionForm } from "@/features/election-special-round/components/election-prediction-form";
import { JoinElectionRound } from "@/features/election-special-round/components/join-election-round";
import { getElectionRoundForUser } from "@/features/election-special-round/data";
import type { ElectionPaymentView } from "@/features/election-special-round/types";
import { formatDateTimeInSaoPaulo, serverNow } from "@/lib/date-time";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function ElectionSpecialRoundPage() {
  const user = await requireUser();
  const round = await getElectionRoundForUser(user.id);
  if (!round) notFound();

  const now = serverNow();
  const entry = round.entries[0] ?? null;
  const open =
    round.status === "REGISTRATION_OPEN" &&
    now >= round.registrationOpensAt &&
    now < round.registrationClosesAt;
  const canPredict = open && entry?.paymentStatus === "APPROVED";
  const pendingPayment: ElectionPaymentView | null =
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
  const collected = round._count.entries * Number(round.entryFee);

  return (
    <PageShell
      description="Evento temporário, independente das ligas e dos rankings de futebol."
      eyebrow="Rodada Especial"
      title={round.name}
    >
      <section className="relative mb-6 overflow-hidden rounded-card border border-brand-gold/35 bg-black p-6 text-white sm:p-8">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(242,185,28,0.24),transparent_36%),linear-gradient(135deg,#050505,#191408)]"
        />
        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-gold">
              <Landmark className="h-4 w-4" /> Eleições 2026
            </span>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
              Acerte os cinco mercados e dispute o prêmio
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">{round.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:w-72">
            <div className="rounded-control border border-white/15 bg-white/5 p-3">
              <p className="text-xs text-white/60">Inscrição</p>
              <p className="mt-1 text-xl font-semibold text-brand-gold">R$ 10,00</p>
            </div>
            <div className="rounded-control border border-white/15 bg-white/5 p-3">
              <p className="text-xs text-white/60">Prêmio atual</p>
              <p className="mt-1 text-xl font-semibold text-brand-gold">
                {collected.toLocaleString("pt-BR", { currency: "BRL", style: "currency" })}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Seu palpite</CardTitle>
            </CardHeader>
            <CardContent>
              {canPredict ? (
                <ElectionPredictionForm
                  candidates={round.candidates}
                  initialPrediction={
                    entry.prediction
                      ? {
                          marginRange: entry.prediction.marginRange,
                          runnerUpCandidateId: entry.prediction.runnerUpCandidateId,
                          turn: entry.prediction.turn,
                          winnerCandidateId: entry.prediction.winnerCandidateId,
                          winnerRange: entry.prediction.winnerRange
                        }
                      : null
                  }
                  roundId={round.id}
                />
              ) : entry?.prediction ? (
                <div className="space-y-3">
                  <p className="rounded-control border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                    Palpite confirmado e bloqueado após o encerramento.
                  </p>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-app-muted">Presidente</dt>
                      <dd className="font-semibold">{entry.prediction.winnerCandidate.name}</dd>
                    </div>
                    <div>
                      <dt className="text-app-muted">Segundo colocado</dt>
                      <dd className="font-semibold">{entry.prediction.runnerUpCandidate.name}</dd>
                    </div>
                    <div>
                      <dt className="text-app-muted">Turno</dt>
                      <dd className="font-semibold">
                        {entry.prediction.turn === "FIRST" ? "1º Turno" : "2º Turno"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-app-muted">Status</dt>
                      <dd className="font-semibold">Registrado</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="text-sm text-app-muted">
                  {!entry
                    ? "Faça sua inscrição para liberar o formulário."
                    : entry.paymentStatus !== "APPROVED"
                      ? "Aguardando a confirmação do pagamento."
                      : "O período de palpites está encerrado."}
                </p>
              )}
            </CardContent>
          </Card>

          {round.status === "FINALIZED" && round.result ? (
            <Card className="border-brand-gold/35">
              <CardHeader>
                <CardTitle>Resultado oficial</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-control border border-app-border p-3">
                    <p className="text-xs text-app-muted">Presidente eleito</p>
                    <p className="mt-1 font-semibold">{round.result.winnerCandidate.name}</p>
                    <p className="text-sm text-brand-gold">
                      {Number(round.result.winnerPercent).toFixed(2)}%
                    </p>
                  </div>
                  <div className="rounded-control border border-app-border p-3">
                    <p className="text-xs text-app-muted">Segundo colocado</p>
                    <p className="mt-1 font-semibold">{round.result.runnerUpCandidate.name}</p>
                    <p className="text-sm text-brand-gold">
                      {Number(round.result.runnerUpPercent).toFixed(2)}%
                    </p>
                  </div>
                </div>
                {round.winners.length ? (
                  <div>
                    <h3 className="font-semibold">Vencedores</h3>
                    <div className="mt-2 space-y-2">
                      {round.winners.map((winner) => (
                        <div
                          className="flex items-center justify-between rounded-control border border-app-border p-3"
                          key={winner.id}
                        >
                          <span>{winner.entry.user.name}</span>
                          <strong className="text-brand-gold">
                            {Number(winner.amount).toLocaleString("pt-BR", {
                              currency: "BRL",
                              style: "currency"
                            })}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-control border border-app-border p-3 text-sm text-app-muted">
                    Sem vencedores.{" "}
                    {round.noWinnerDestination
                      ? `Destino da premiação: ${round.noWinnerDestination}`
                      : "O destino da premiação será definido pelo administrador."}
                  </p>
                )}
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
                <CalendarClock className="h-4 w-4 text-brand-gold" />
                Encerra em {formatDateTimeInSaoPaulo(round.registrationClosesAt)}
              </p>
              <p className="flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-gold" />
                {round._count.entries} participantes pagos
              </p>
              <p className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-brand-gold" />
                Prêmio dividido entre todos que acertarem os cinco mercados
              </p>
            </CardContent>
          </Card>

          {(!entry || entry.paymentStatus === "PENDING") && open ? (
            <JoinElectionRound
              initialPayment={pendingPayment}
              name={round.name}
              roundId={round.id}
            />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Lista de candidatos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {round.candidates.map((candidate, index) => (
                <div
                  className="flex items-center gap-3 rounded-control border border-app-border p-3"
                  key={candidate.id}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gold/15 text-xs font-semibold text-brand-gold">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{candidate.name}</p>
                    <p className="text-xs text-app-muted">{candidate.party}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {round.rules ? (
            <Card>
              <CardHeader>
                <CardTitle>Regulamento</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-6 text-app-muted">
                  {round.rules}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </PageShell>
  );
}
