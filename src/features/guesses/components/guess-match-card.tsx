"use client";

/* eslint-disable @next/next/no-img-element */
import {
  CalendarClock,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LockKeyhole,
  MapPin,
  Pencil,
  Radio,
  Star
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGuessDate, type GuessMatchView, type GuessView } from "../data/guess-data";
import {
  formatGuessTimeRemaining,
  getGuessCardState,
  hasCompleteGuess,
  isStartingSoon
} from "../guess-status";
import { getTeamLogoSrc } from "@/lib/team-logo";
import { cn } from "@/lib/utils";
import { GuessForm, type GuessDraftState } from "./guess-form";

type GuessMatchCardProps = {
  draftState?: GuessDraftState;
  highlighted: boolean;
  jokerLocked: boolean;
  match: GuessMatchView;
  nowMs: number;
  onAdvanceRequested: (matchId: string) => void;
  onDeleted: (matchId: string) => void;
  onDraftStateChange: (matchId: string, state: GuessDraftState) => void;
  onSaved: (matchId: string, guess: GuessView) => void;
  roundJokerMatchId: string | null;
  roundJokerMatchName: string | null;
};

type TeamMarkProps = GuessMatchView["homeTeam"] & {
  align?: "left" | "right";
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

function TeamMark({ align = "left", apiId, logo, name, shortName }: TeamMarkProps) {
  const logoSrc = getTeamLogoSrc({ apiId, logo });

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3",
        align === "right" ? "flex-row-reverse text-right" : ""
      )}
    >
      <span
        aria-label={name}
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-elevated text-sm font-bold text-app-foreground"
        role="img"
      >
        {logoSrc ? (
          <img
            alt=""
            className="h-9 w-9 object-contain"
            referrerPolicy="no-referrer"
            src={logoSrc}
          />
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

function guessScore(guess: GuessView | null) {
  if (guess?.homePrediction === null || guess?.awayPrediction === null || !guess) return "Sem palpite";

  return `${guess.homePrediction} x ${guess.awayPrediction}`;
}

function cardStatus(match: GuessMatchView, draftState?: GuessDraftState) {
  const state = getGuessCardState(match);

  if (state === "PENDING" && draftState?.incomplete) {
    return {
      icon: CircleAlert,
      label: draftState.homeFilled ? "Falta o placar visitante" : "Falta o placar mandante",
      tone: "danger" as const
    };
  }

  if (state === "PENDING" && match.existingGuess && !hasCompleteGuess(match)) {
    const missingHome = match.existingGuess.homePrediction === null;
    const missingAway = match.existingGuess.awayPrediction === null;
    const label =
      missingHome && missingAway
        ? "Complete o placar"
        : missingHome
          ? "Falta o placar mandante"
          : "Falta o placar visitante";

    return { icon: CircleAlert, label, tone: "danger" as const };
  }

  if (state === "PENDING") {
    return { icon: CircleAlert, label: "Palpite pendente", tone: "warning" as const };
  }

  if (state === "SAVED") {
    return { icon: CheckCircle2, label: "Palpite salvo", tone: "success" as const };
  }

  if (state === "LIVE") {
    return {
      icon: Radio,
      label: match.elapsed ? `Ao vivo - ${match.elapsed}'` : "Ao vivo",
      tone: "danger" as const
    };
  }

  if (state === "FINISHED") {
    return {
      icon: CheckCircle2,
      label: match.status === "CANCELLED" ? "Partida cancelada" : "Finalizada",
      tone: "neutral" as const
    };
  }

  return { icon: LockKeyhole, label: "Palpites encerrados", tone: "neutral" as const };
}

export function GuessMatchCard({
  draftState,
  highlighted,
  jokerLocked,
  match,
  nowMs,
  onAdvanceRequested,
  onDeleted,
  onDraftStateChange,
  onSaved,
  roundJokerMatchId,
  roundJokerMatchName
}: GuessMatchCardProps) {
  const [editing, setEditing] = useState(!match.existingGuess);
  const state = getGuessCardState(match);
  const status = cardStatus(match, draftState);
  const StatusIcon = status.icon;
  const startingSoon = nowMs > 0 && isStartingSoon(match, nowMs);
  const remainingMs = nowMs > 0 ? new Date(match.kickoff).getTime() - nowMs : null;
  const criticalDeadline = remainingMs !== null && remainingMs > 0 && remainingMs <= 15 * 60_000;
  const showForm = match.canEdit && (state === "PENDING" || editing);
  const realScore =
    match.homeScore === null || match.awayScore === null
      ? null
      : `${match.homeScore} x ${match.awayScore}`;

  return (
    <Card
      className={cn(
        "scroll-mt-28 overflow-hidden transition duration-300",
        state === "PENDING" ? "border-amber-500/40" : "",
        state === "SAVED" ? "border-emerald-500/30" : "",
        state === "LIVE" ? "border-red-500/40" : "",
        highlighted ? "ring-2 ring-brand-gold ring-offset-2 ring-offset-app-background" : ""
      )}
      id={`guess-match-${match.id}`}
    >
      <CardHeader className="border-b border-app-border p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate text-base">{match.championshipName}</CardTitle>
            <p className="truncate text-xs text-app-muted">
              {match.leagueName} | {match.roundLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>
              <StatusIcon aria-hidden className="mr-1 h-3.5 w-3.5" />
              {status.label}
            </Badge>
            {match.existingGuess?.joker ? (
              <Badge tone="warning">
                <Star aria-hidden className="mr-1 h-3.5 w-3.5 fill-current" />
                Coringa
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-control border border-app-border bg-app-background p-3 sm:gap-4 sm:p-4">
          <TeamMark {...match.homeTeam} />
          <div className="text-center">
            {realScore && (state === "LIVE" || state === "FINISHED") ? (
              <span className="text-lg font-black text-app-foreground">{realScore}</span>
            ) : (
              <span className="text-xs font-bold uppercase text-app-muted">vs</span>
            )}
          </div>
          <TeamMark {...match.awayTeam} align="right" />
        </div>

        <div className="grid gap-2 text-sm text-app-muted sm:grid-cols-2">
          <p className="flex items-center gap-2">
            <CalendarClock aria-hidden className="h-4 w-4 shrink-0 text-brand-gold" />
            {formatGuessDate(match.kickoff)}
          </p>
          {match.canEdit && nowMs > 0 ? (
            <p
              className={cn(
                "flex items-center gap-2 font-semibold",
                criticalDeadline
                  ? "text-red-300"
                  : startingSoon
                    ? "text-amber-300"
                    : "text-app-muted"
              )}
            >
              <Clock3 aria-hidden className="h-4 w-4 shrink-0" />
              {formatGuessTimeRemaining(match.kickoff, nowMs)}
            </p>
          ) : null}
          {match.stadium || match.city ? (
            <p className="flex items-center gap-2 sm:col-span-2">
              <MapPin aria-hidden className="h-4 w-4 shrink-0 text-brand-gold" />
              <span className="truncate">{[match.stadium, match.city].filter(Boolean).join(" - ")}</span>
            </p>
          ) : null}
        </div>

        {match.existingGuess ? (
          <div className="flex flex-col gap-3 rounded-control border border-app-border bg-app-elevated p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-app-muted">Seu palpite</p>
              <p className="mt-1 text-xl font-black text-app-foreground">
                {guessScore(match.existingGuess)}
              </p>
              <p className="mt-1 text-xs text-app-muted">
                Salvo em {formatGuessDate(match.existingGuess.updatedAt)}
              </p>
            </div>
            {match.existingGuess.score ? (
              <div className="sm:text-right">
                <p className="text-lg font-bold text-brand-gold">
                  {match.existingGuess.score.totalPoints} pts
                </p>
                <p className="text-xs text-app-muted">
                  {match.existingGuess.score.exactScore
                    ? "Placar exato"
                    : match.existingGuess.score.winnerHit
                      ? "Resultado correto"
                      : "Palpite incorreto"}
                </p>
              </div>
            ) : null}
          </div>
        ) : !match.canEdit ? (
          <p className="rounded-control border border-app-border bg-app-background p-3 text-sm text-app-muted">
            Nenhum palpite foi registrado antes do encerramento.
          </p>
        ) : null}

        {state === "SAVED" && !editing ? (
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-button border border-app-border px-4 text-sm font-semibold text-app-foreground hover:border-brand-gold hover:text-brand-gold"
            onClick={() => setEditing(true)}
            type="button"
          >
            <Pencil aria-hidden className="h-4 w-4" />
            Editar palpite
          </button>
        ) : null}

        {showForm ? (
          <GuessForm
            existingGuess={match.existingGuess}
            jokerLimit={match.scoring.jokerLimitPerRound}
            jokerLocked={jokerLocked}
            leagueId={match.leagueId}
            matchId={match.id}
            matchName={`${match.homeTeam.name} x ${match.awayTeam.name}`}
            onAdvanceRequested={(matchId) => {
              setEditing(false);
              onAdvanceRequested(matchId);
            }}
            onDeleted={(matchId) => {
              setEditing(true);
              onDeleted(matchId);
            }}
            onDraftStateChange={onDraftStateChange}
            onSaved={onSaved}
            roundJokerMatchId={roundJokerMatchId}
            roundJokerMatchName={roundJokerMatchName}
            scoring={match.scoring}
          />
        ) : null}

        <Link
          className="inline-flex h-10 items-center justify-center gap-2 rounded-button border border-app-border px-4 text-sm font-semibold text-app-muted hover:border-brand-blue hover:text-brand-blue"
          href={`/partidas/${match.id}`}
        >
          <ChartNoAxesCombined aria-hidden className="h-4 w-4" />
          Ver detalhes
        </Link>
      </CardContent>
    </Card>
  );
}
