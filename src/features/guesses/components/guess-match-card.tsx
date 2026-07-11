/* eslint-disable @next/next/no-img-element */
import { CalendarClock, MapPin, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGuessDate, type AvailableMatchView } from "../data/guess-data";
import { GuessForm } from "./guess-form";

type GuessMatchCardProps = {
  match: AvailableMatchView;
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
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-label={name}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-elevated bg-contain bg-center bg-no-repeat text-sm font-bold text-app-foreground"
        role="img"
      >
        {logo ? (
          <img alt="" className="h-8 w-8 object-contain" referrerPolicy="no-referrer" src={logo} />
        ) : (
          getInitials(shortName || name)
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-app-foreground">{name}</span>
        {shortName ? <span className="block text-xs text-app-muted">{shortName}</span> : null}
      </span>
    </div>
  );
}

export function GuessMatchCard({ match }: GuessMatchCardProps) {
  return (
    <Card>
      <CardHeader className="border-b border-app-border">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">{match.championshipName}</CardTitle>
            <p className="text-sm text-app-muted">
              {match.leagueName ? `${match.leagueName} | ` : ""}
              {match.roundLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={match.existingGuess ? "success" : "info"}>
              {match.existingGuess ? "Palpite enviado" : "Aberto"}
            </Badge>
            {match.existingGuess?.joker ? <Badge tone="warning">Curinga</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid gap-4 rounded-card border border-app-border bg-app-background p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <TeamMark {...match.homeTeam} />
          <span className="hidden text-center text-sm font-bold uppercase text-app-muted sm:block">
            vs
          </span>
          <TeamMark {...match.awayTeam} />
        </div>

        <div className="grid gap-3 text-sm text-app-muted sm:grid-cols-2">
          <p className="flex items-center gap-2">
            <CalendarClock aria-hidden className="h-4 w-4 text-brand-gold" />
            {formatGuessDate(match.kickoff)}
          </p>
          <p className="flex items-center gap-2">
            <ShieldCheck aria-hidden className="h-4 w-4 text-brand-gold" />
            {match.status === "SCHEDULED" ? "Partida aberta para palpite" : match.status}
          </p>
          {match.stadium || match.city ? (
            <p className="flex items-center gap-2 sm:col-span-2">
              <MapPin aria-hidden className="h-4 w-4 text-brand-gold" />
              {[match.stadium, match.city].filter(Boolean).join(" - ")}
            </p>
          ) : null}
        </div>

        <GuessForm
          existingGuess={match.existingGuess}
          jokerAvailable={match.jokerAvailable}
          jokerLimit={match.jokerLimit}
          leagueId={match.leagueId ?? undefined}
          matchId={match.id}
          scoring={match.scoring}
          usedJokersInRound={match.usedJokersInRound}
        />
      </CardContent>
    </Card>
  );
}
