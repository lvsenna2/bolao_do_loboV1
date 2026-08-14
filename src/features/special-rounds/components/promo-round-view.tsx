import { CalendarClock, Flame, Trophy } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents, getWalletBalance } from "@/features/wallet/services/wallet-service";
import { formatDateTimeInSaoPaulo, serverNow } from "@/lib/date-time";
import type { getPromoRoundForUser } from "../data/special-round-data";
import {
  isPromoBettingOpen,
  promoMaxStakeCents,
  promoMinStakeCents,
  promoProfitCents,
  promoReturnCents,
  promoSelectionText
} from "../services/promo-service";
import { SpecialRoundMatchScoreboard } from "./match-scoreboard";
import { PromoBetForm } from "./promo-bet-form";

type PromoRound = NonNullable<Awaited<ReturnType<typeof getPromoRoundForUser>>>;

/**
 * Pagina da promocao. Fluxo de um passo so: o usuario ve a oferta que viu no anuncio, digita
 * o valor e confirma. Nada de montar palpite ou escolher mercado.
 */
export async function PromoRoundView({ round, userId }: { round: PromoRound; userId: string }) {
  const now = serverNow();
  const wallet = await getWalletBalance(userId);
  const odds = Number(round.promoOdds ?? 0);
  const maxStakeCents = promoMaxStakeCents(round);
  const minStakeCents = promoMinStakeCents(round);
  const selection = promoSelectionText(round);
  const bettingOpen = isPromoBettingOpen({
    closesAt: round.registrationClosesAt,
    matchStatus: round.match?.status,
    now,
    opensAt: round.registrationOpensAt,
    status: round.status
  });
  const prize = round.userEntry?.prize ?? null;
  const settled = ["FINALIZED", "CANCELLED"].includes(round.status);

  return (
    <PageShell
      description={`${round.homeTeamName} x ${round.awayTeamName} | ${formatDateTimeInSaoPaulo(round.matchStartsAt)}`}
      eyebrow="Oferta especial"
      title={round.name}
    >
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="space-y-6">
          <Card className="overflow-hidden border-2 border-brand-gold bg-black text-white">
            {round.promoBannerUrl ? (
              // O banner da campanha vem de onde o marketing hospedar, fora da lista de hosts
              // otimizados do next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={selection}
                className="h-auto w-full object-cover"
                decoding="async"
                referrerPolicy="no-referrer"
                src={round.promoBannerUrl}
              />
            ) : null}
            <CardContent className="relative p-5 sm:p-7">
              <div
                aria-hidden
                className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(242,185,28,0.22),transparent_50%)]"
              />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-button bg-brand-gold px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-black">
                  <Flame aria-hidden className="h-4 w-4" /> Rodada especial
                </span>
                <p className="mt-5 text-2xl font-extrabold uppercase leading-tight text-brand-gold sm:text-4xl">
                  {selection}
                </p>
                {round.promoHeadline ? (
                  <p className="mt-2 text-sm text-white/75">{round.promoHeadline}</p>
                ) : null}
                <dl className="mt-6 grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-control border border-brand-gold/45 bg-brand-gold/10 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                      Odd promocional
                    </dt>
                    <dd className="mt-1 text-3xl font-extrabold tabular-nums text-brand-gold">
                      {odds.toFixed(2)}
                    </dd>
                  </div>
                  <div className="rounded-control border border-brand-gold/45 bg-brand-gold/10 p-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                      Limite por usuario
                    </dt>
                    <dd className="mt-1 text-3xl font-extrabold tabular-nums text-brand-gold">
                      {formatCents(maxStakeCents)}
                    </dd>
                  </div>
                </dl>
              </div>
            </CardContent>
          </Card>

          <Card className="border-brand-gold/40">
            <CardHeader>
              <CardTitle>{bettingOpen ? "Sua aposta" : "Promocao encerrada"}</CardTitle>
            </CardHeader>
            <CardContent>
              {bettingOpen ? (
                <PromoBetForm
                  balanceCents={wallet.totalCents}
                  maxStakeCents={maxStakeCents}
                  minStakeCents={minStakeCents}
                  odds={odds}
                  specialRoundId={round.id}
                  stakedCents={round.userStakedCents}
                />
              ) : (
                <p className="text-sm text-app-muted">
                  {round.status === "CANCELLED"
                    ? "Esta promocao foi cancelada e o valor apostado voltou para a sua carteira."
                    : "Esta promocao nao esta mais aceitando apostas."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>A partida</CardTitle>
            </CardHeader>
            <CardContent>
              <SpecialRoundMatchScoreboard
                match={{
                  awayScore: round.match?.awayScore ?? null,
                  awayTeamApiId: round.match?.awayTeam.apiId ?? null,
                  awayTeamLogo: round.awayTeamLogo,
                  awayTeamName: round.awayTeamName,
                  elapsed: round.match?.elapsed ?? null,
                  homeScore: round.match?.homeScore ?? null,
                  homeTeamApiId: round.match?.homeTeam.apiId ?? null,
                  homeTeamLogo: round.homeTeamLogo,
                  homeTeamName: round.homeTeamName,
                  matchStartsAt: round.matchStartsAt,
                  penaltyAway: null,
                  penaltyHome: null,
                  status: round.match?.status ?? null
                }}
              />
            </CardContent>
          </Card>
        </main>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Como funciona</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-app-muted">
              <p className="flex items-start gap-2">
                <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
                Se {selection.toLowerCase()}, voce recebe o valor apostado de volta e o lucro
                (aposta x {odds.toFixed(2)} menos a aposta) entra como saldo bonus.
              </p>
              <p className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
                Apostas ate {formatDateTimeInSaoPaulo(round.registrationClosesAt)} ou o fim do
                jogo, o que vier primeiro.
              </p>
              <p>
                O saldo bonus vale em qualquer aposta ou bolao do Bolao do Lobo, mas nao pode ser
                sacado.
              </p>
              <p>
                Exemplo: aposta de {formatCents(500)} vira{" "}
                {formatCents(promoReturnCents(500, odds))} — {formatCents(500)} do valor apostado
                e {formatCents(promoProfitCents(500, odds))} de bonus.
              </p>
            </CardContent>
          </Card>

          {round.userStakedCents > 0 ? (
            <Card className="border-brand-gold/40">
              <CardHeader>
                <CardTitle>Minha aposta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="flex justify-between">
                  <span className="text-app-muted">Selecao</span>
                  <strong className="text-right">{selection}</strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-app-muted">Valor apostado</span>
                  <strong>{formatCents(round.userStakedCents)}</strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-app-muted">Retorno se bater</span>
                  <strong className="text-brand-gold">
                    {formatCents(promoReturnCents(round.userStakedCents, odds))}
                  </strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-app-muted">Bonus</span>
                  <strong className="text-brand-gold">
                    {formatCents(promoProfitCents(round.userStakedCents, odds))}
                  </strong>
                </p>
                {settled ? (
                  <p className="mt-3 rounded-control border border-app-border p-3 text-center font-semibold">
                    {prize
                      ? `Aposta premiada: ${formatCents(Math.round(Number(prize.amount) * 100))} creditados.`
                      : round.status === "CANCELLED"
                        ? "Promocao cancelada e valor devolvido."
                        : "Nao foi dessa vez."}
                  </p>
                ) : null}
              </CardContent>
            </Card>
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
