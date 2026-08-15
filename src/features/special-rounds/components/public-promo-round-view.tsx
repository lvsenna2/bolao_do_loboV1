import type { Route } from "next";
import Link from "next/link";
import { CalendarClock, Flame, ShieldCheck, Trophy } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { getPublicPromoRoundBySlug } from "../data/public-promo-data";
import { formatDateTimeInSaoPaulo, serverNow } from "@/lib/date-time";
import {
  isPromoBettingOpen,
  promoMaxStakeCents,
  promoMinStakeCents,
  promoReturnCents,
  promoSelectionText
} from "../services/promo-service";
import { SpecialRoundMatchScoreboard } from "./match-scoreboard";

type PublicPromoRound = NonNullable<Awaited<ReturnType<typeof getPublicPromoRoundBySlug>>>;

type PublicPromoRoundViewProps = {
  callbackUrl: string;
  isAuthenticated: boolean;
  round: PublicPromoRound;
};

function formatCents(value: number) {
  return new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" }).format(value / 100);
}

function resolvePublicBannerUrl(value: string | null) {
  if (!value) return null;
  if (value.startsWith("/")) return value;

  try {
    const url = new URL(value);
    const isProjectHost =
      url.hostname.endsWith(".vercel.app") ||
      url.hostname === "simuladorcopa2026.com.br" ||
      url.hostname === "www.simuladorcopa2026.com.br";

    if (isProjectHost && url.pathname.startsWith("/banners/")) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return value;
  }

  return value;
}

export function PublicPromoRoundView({
  callbackUrl,
  isAuthenticated,
  round
}: PublicPromoRoundViewProps) {
  const now = serverNow();
  const odds = Number(round.promoOdds ?? 0);
  const maxStakeCents = promoMaxStakeCents(round);
  const minStakeCents = promoMinStakeCents(round);
  const selection = promoSelectionText(round);
  const bannerUrl = resolvePublicBannerUrl(round.promoBannerUrl);
  const bettingOpen = isPromoBettingOpen({
    closesAt: round.registrationClosesAt,
    matchStatus: round.match?.status,
    now,
    opensAt: round.registrationOpensAt,
    status: round.status
  });
  const primaryHref = (isAuthenticated
    ? `/rodadas-especiais/${round.id}`
    : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`) as Route;
  const registerHref = `/register?callbackUrl=${encodeURIComponent(callbackUrl)}` as Route;

  return (
    <PageShell
      actions={
        bettingOpen ? (
          <Link className={buttonVariants({ size: "lg", variant: "accent" })} href={primaryHref}>
            {isAuthenticated ? "Fazer minha aposta" : "Entrar para apostar"}
          </Link>
        ) : undefined
      }
      description={`${round.homeTeamName} x ${round.awayTeamName} | ${formatDateTimeInSaoPaulo(round.matchStartsAt)}`}
      eyebrow="Oferta especial"
      title={round.name}
    >
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="space-y-6">
          <Card className="overflow-hidden border-2 border-brand-gold bg-black text-white">
            {bannerUrl ? (
              // A imagem pode vir de uma URL cadastrada pelo marketing.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={selection}
                className="h-auto w-full object-cover"
                decoding="async"
                referrerPolicy="no-referrer"
                src={bannerUrl}
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
              <CardTitle>{bettingOpen ? "Participe da promocao" : "Promocao encerrada"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {bettingOpen ? (
                <>
                  <p className="text-sm leading-6 text-app-muted">
                    Entre na sua conta para confirmar o valor do palpite. O minimo e{" "}
                    <strong className="text-app-foreground">{formatCents(minStakeCents)}</strong> e
                    o limite total por usuario e{" "}
                    <strong className="text-app-foreground">{formatCents(maxStakeCents)}</strong>.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Link
                      className={buttonVariants({ size: "lg", variant: "accent" })}
                      href={primaryHref}
                    >
                      {isAuthenticated ? "Fazer minha aposta" : "Entrar para apostar"}
                    </Link>
                    {!isAuthenticated ? (
                      <Link
                        className={buttonVariants({ size: "lg", variant: "secondary" })}
                        href={registerHref}
                      >
                        Criar conta
                      </Link>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-sm text-app-muted">
                  {round.status === "CANCELLED"
                    ? "Esta promocao foi cancelada."
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
                  awayTeamLogo: round.match?.awayTeam.logo ?? round.awayTeamLogo,
                  awayTeamName: round.awayTeamName,
                  elapsed: round.match?.elapsed ?? null,
                  homeScore: round.match?.homeScore ?? null,
                  homeTeamApiId: round.match?.homeTeam.apiId ?? null,
                  homeTeamLogo: round.match?.homeTeam.logo ?? round.homeTeamLogo,
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
                O palpite ja vem definido: {selection.toLowerCase()}.
              </p>
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
                Se o palpite bater, o valor apostado volta e o lucro e creditado como saldo bonus,
                conforme o regulamento.
              </p>
              <p className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
                Apostas ate {formatDateTimeInSaoPaulo(round.registrationClosesAt)} ou o fim do
                jogo, o que vier primeiro.
              </p>
              <p>
                Exemplo: um palpite de {formatCents(500)} tem retorno total de{" "}
                {formatCents(promoReturnCents(500, odds))} se acertar.
              </p>
            </CardContent>
          </Card>

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

          <p className="rounded-control border border-app-border bg-app-elevated p-3 text-center text-xs text-app-muted">
            18+ | Jogue com responsabilidade.
          </p>
        </aside>
      </div>
    </PageShell>
  );
}
