/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CalendarClock, ClipboardCheck, MapPin, Trophy } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  formatRoundDate,
  getRoundLabel,
  type RoundMatchView,
  type RoundView
} from "../data/round-data";
import { RoundStatusBadge } from "./round-status-badge";

type RoundCardProps = {
  round: RoundView;
};

type TeamMarkProps = {
  logo: string | null;
  name: string;
  shortName: string | null;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function TeamMark({ logo, name, shortName }: TeamMarkProps) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        aria-label={name}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-elevated bg-contain bg-center bg-no-repeat text-xs font-bold text-app-foreground"
        role="img"
      >
        {logo ? (
          <img alt="" className="h-7 w-7 object-contain" referrerPolicy="no-referrer" src={logo} />
        ) : (
          getInitials(shortName || name)
        )}
      </span>
      <span className="truncate font-semibold text-app-foreground">{shortName || name}</span>
    </span>
  );
}

function MatchRow({
  match,
  roundStatus
}: {
  match: RoundMatchView;
  roundStatus: RoundView["status"];
}) {
  const canGuess =
    roundStatus === "OPEN" && match.status === "SCHEDULED" && new Date(match.kickoff) > new Date();
  const score =
    match.homeScore === null || match.awayScore === null
      ? "x"
      : `${match.homeScore} x ${match.awayScore}`;
  const guessScore =
    match.guess?.homePrediction === null || match.guess?.awayPrediction === null || !match.guess
      ? null
      : `${match.guess.homePrediction} x ${match.guess.awayPrediction}`;

  return (
    <div className="grid gap-3 rounded-control border border-app-border bg-app-background p-3 lg:grid-cols-[1fr_auto_1fr_auto] lg:items-center">
      <TeamMark {...match.homeTeam} />
      <span className="text-center text-sm font-bold text-app-muted">{score}</span>
      <TeamMark {...match.awayTeam} />
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <RoundStatusBadge type="match" value={match.status} />
        {guessScore ? (
          <span className="inline-flex h-6 items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {guessScore}
          </span>
        ) : null}
        {match.guess?.score ? (
          <span className="inline-flex h-6 items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2 text-xs font-semibold text-blue-700 dark:text-blue-300">
            {match.guess.score.totalPoints} pts
          </span>
        ) : null}
        {canGuess ? (
          <Link className={cn(buttonVariants({ size: "sm", variant: "accent" }))} href="/palpites">
            Palpitar
          </Link>
        ) : null}
      </div>
      <p className="flex items-center gap-2 text-xs text-app-muted lg:col-span-4">
        <CalendarClock aria-hidden className="h-4 w-4 text-brand-gold" />
        {formatRoundDate(match.kickoff)}
        {match.stadium || match.city ? (
          <>
            <MapPin aria-hidden className="ml-2 h-4 w-4 text-brand-gold" />
            {[match.stadium, match.city].filter(Boolean).join(" - ")}
          </>
        ) : null}
      </p>
    </div>
  );
}

export function RoundCard({ round }: RoundCardProps) {
  return (
    <Card>
      <CardHeader className="border-b border-app-border">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy aria-hidden className="h-5 w-5 text-brand-gold" />
              {getRoundLabel(round)}
            </CardTitle>
            <p className="text-sm text-app-muted">
              {round.leagueName ? `${round.leagueName} | ` : ""}
              {round.championshipName} - {round.seasonName}
            </p>
          </div>
          <RoundStatusBadge value={round.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-control bg-app-background p-3">
            <p className="text-xs text-app-muted">Jogos</p>
            <p className="mt-1 text-xl font-bold text-app-foreground">{round.totalMatches}</p>
          </div>
          <div className="rounded-control bg-app-background p-3">
            <p className="text-xs text-app-muted">Restantes</p>
            <p className="mt-1 text-xl font-bold text-app-foreground">{round.remainingMatches}</p>
          </div>
          <div className="rounded-control bg-app-background p-3">
            <p className="text-xs text-app-muted">Meus palpites</p>
            <p className="mt-1 text-xl font-bold text-app-foreground">{round.submittedGuesses}</p>
          </div>
          <div className="rounded-control bg-app-background p-3">
            <p className="text-xs text-app-muted">Prazo</p>
            <p className="mt-1 text-sm font-semibold text-app-foreground">
              {formatRoundDate(round.endsAt)}
            </p>
          </div>
        </div>

        {round.description ? (
          <p className="text-sm leading-6 text-app-muted">{round.description}</p>
        ) : null}

        <div className="space-y-3">
          {round.matches.length > 0 ? (
            round.matches.map((match) => (
              <MatchRow key={match.id} match={match} roundStatus={round.status} />
            ))
          ) : (
            <div className="flex items-center gap-2 rounded-control border border-dashed border-app-border bg-app-background p-4 text-sm text-app-muted">
              <ClipboardCheck aria-hidden className="h-4 w-4 text-brand-gold" />
              Nenhuma partida cadastrada nesta rodada.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
