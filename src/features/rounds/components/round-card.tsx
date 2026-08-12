import Link from "next/link";
import type { Route } from "next";
import { CalendarClock, ChevronDown, ClipboardCheck, MapPin, Trophy } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { FootballLogo } from "@/components/football/football-logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { identifyTwoLegMatches, type MatchLegRole } from "@/features/matches/two-leg";
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
  apiId: number | null;
  logo: string | null;
  name: string;
  shortName: string | null;
};

function TeamMark({ apiId, logo, name, shortName }: TeamMarkProps) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <FootballLogo
        apiId={apiId}
        className="p-1"
        kind="team"
        logo={logo}
        name={shortName || name}
        size={36}
      />
      <span className="truncate font-semibold text-app-foreground">{shortName || name}</span>
    </span>
  );
}

function MatchRow({
  match,
  legRole,
  roundStatus
}: {
  match: RoundMatchView;
  legRole?: MatchLegRole;
  roundStatus: RoundView["status"];
}) {
  const canGuess = roundStatus === "OPEN" && match.canGuess;
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
        {legRole ? (
          <span className="inline-flex h-6 items-center rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2 text-xs font-semibold text-brand-gold">
            Jogo de {legRole === "IDA" ? "ida" : "volta"}
          </span>
        ) : null}
        {guessScore ? (
          <span className="inline-flex h-6 items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {guessScore}
          </span>
        ) : null}
        {match.guess?.score ? (
          <span className="inline-flex h-6 items-center rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2 text-xs font-semibold text-brand-gold">
            {match.guess.score.totalPoints} pts
          </span>
        ) : null}
        <Link
          className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}
          href={`/partidas/${match.id}` as Route}
        >
          Detalhes
        </Link>
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
  const legRoles = identifyTwoLegMatches(round.matches);

  return (
    <Card className="performance-card">
      <CardHeader className="p-4">
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
        <div className="flex flex-wrap gap-2 text-xs text-app-muted">
          <span>{round.totalMatches} jogos</span>
          <span>|</span>
          <span>{round.submittedGuesses} palpites</span>
          <span>|</span>
          <span>{round.remainingMatches} restantes</span>
          <span>|</span>
          <span>{formatRoundDate(round.endsAt)}</span>
        </div>
      </CardHeader>
      <CardContent className="border-t border-app-border p-0">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-app-foreground">
            Ver partidas
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-3 border-t border-app-border p-4">
            {round.matches.length > 0 ? (
              round.matches.map((match) => (
                <MatchRow
                  key={match.id}
                  legRole={legRoles.get(match.id)}
                  match={match}
                  roundStatus={round.status}
                />
              ))
            ) : (
              <div className="flex items-center gap-2 rounded-control border border-dashed border-app-border bg-app-background p-4 text-sm text-app-muted">
                <ClipboardCheck aria-hidden className="h-4 w-4 text-brand-gold" />
                Nenhuma partida cadastrada nesta rodada.
              </div>
            )}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
