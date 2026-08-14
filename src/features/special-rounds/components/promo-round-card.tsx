import type { MatchStatus } from "@prisma/client";
import { Flame } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { FootballLogo } from "@/components/football/football-logo";
import { formatCents } from "@/features/wallet/services/wallet-service";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";

type Props = {
  awayTeamApiId?: number | null;
  awayTeamLogo: string | null;
  awayTeamName: string;
  bettingOpen: boolean;
  headline: string | null;
  homeTeamApiId?: number | null;
  homeTeamLogo: string | null;
  homeTeamName: string;
  href: string;
  matchStartsAt: Date;
  matchStatus?: MatchStatus | null;
  maxStakeCents: number;
  odds: number;
  selectionLabel: string;
  userStakedCents: number;
};

/**
 * Card da promocao. Precisa gritar mais que a Rodada Especial comum: quem chega do anuncio
 * tem que bater o olho e reconhecer a mesma oferta — selecao, odd e teto — sem ler nada mais.
 */
export function PromoRoundCard(props: Props) {
  const remainingCents = Math.max(props.maxStakeCents - props.userStakedCents, 0);

  return (
    <Link
      className="group relative block overflow-hidden rounded-card border-2 border-brand-gold bg-black text-white shadow-[0_0_35px_-12px_rgba(242,185,28,0.65)] transition hover:border-amber-300"
      href={props.href as Route}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(242,185,28,0.28),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(242,185,28,0.18),transparent_40%)]"
      />
      <div className="relative p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-button bg-brand-gold px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-black">
            <Flame aria-hidden className="h-4 w-4" /> Oferta especial
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
            {props.bettingOpen
              ? formatDateTimeInSaoPaulo(props.matchStartsAt)
              : "Promocao encerrada"}
          </span>
        </div>

        <div className="mt-5 flex items-center justify-center gap-5 sm:gap-8">
          <FootballLogo
            apiId={props.homeTeamApiId}
            containerClassName="border-brand-gold/40"
            kind="team"
            logo={props.homeTeamLogo}
            name={props.homeTeamName}
            size={56}
          />
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
            {props.homeTeamName} x {props.awayTeamName}
          </span>
          <FootballLogo
            apiId={props.awayTeamApiId}
            containerClassName="border-brand-gold/40"
            kind="team"
            logo={props.awayTeamLogo}
            name={props.awayTeamName}
            size={56}
          />
        </div>

        <p className="mt-6 text-center text-2xl font-extrabold uppercase leading-tight tracking-tight text-brand-gold sm:text-4xl">
          {props.selectionLabel}
        </p>
        {props.headline ? (
          <p className="mt-2 text-center text-sm text-white/75">{props.headline}</p>
        ) : null}

        <dl className="mt-6 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-control border border-brand-gold/45 bg-brand-gold/10 p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
              Odd
            </dt>
            <dd className="mt-1 text-3xl font-extrabold tabular-nums text-brand-gold">
              {props.odds.toFixed(2)}
            </dd>
          </div>
          <div className="rounded-control border border-brand-gold/45 bg-brand-gold/10 p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
              Aposte ate
            </dt>
            <dd className="mt-1 text-3xl font-extrabold tabular-nums text-brand-gold">
              {formatCents(props.maxStakeCents)}
            </dd>
          </div>
        </dl>

        <p className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-button bg-brand-gold px-5 text-base font-bold uppercase tracking-wide text-black transition group-hover:bg-amber-300">
          {props.bettingOpen ? "Quero apostar" : "Ver promocao"}
        </p>
        {props.userStakedCents > 0 ? (
          <p className="mt-3 text-center text-xs text-white/70">
            Voce ja apostou {formatCents(props.userStakedCents)}
            {remainingCents > 0
              ? ` | ainda pode apostar ${formatCents(remainingCents)}`
              : " | limite atingido"}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
