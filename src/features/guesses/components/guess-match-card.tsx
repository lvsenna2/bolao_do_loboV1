"use client";

import {
  ChartNoAxesCombined,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  Pencil,
  Radio,
  Star
} from "lucide-react";
import Link from "next/link";
import { memo, useState } from "react";

import { FootballLogo } from "@/components/football/football-logo";
import { Badge } from "@/components/ui/badge";
import type { MatchLegRole } from "@/features/matches/two-leg";
import { cn } from "@/lib/utils";
import type { GuessMatchView, GuessView, TeamView } from "../data/guess-data";
import {
  formatGuessDeadline,
  formatGuessKickoff,
  getGuessCardState,
  isStartingSoon
} from "../guess-status";
import { GuessForm } from "./guess-form";

type GuessMatchCardProps = {
  highlighted: boolean;
  jokerLocked: boolean;
  legRole?: MatchLegRole;
  match: GuessMatchView;
  nowMs: number;
  onAdvanceRequested: (matchId: string) => void;
  onDeleted: (matchId: string) => void;
  onSaved: (matchId: string, guess: GuessView) => void;
  roundJokerMatchId: string | null;
  roundJokerMatchName: string | null;
};

function TeamResultRow({ score, team }: { score: number | null; team: TeamView }) {
  return (
    <div className="flex min-h-12 items-center gap-2.5">
      <FootballLogo
        apiId={team.apiId}
        className="p-1"
        kind="team"
        logo={team.logo}
        name={team.shortName || team.name}
        size={28}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-app-foreground">
        {team.name}
      </span>
      <span className="inline-flex h-10 w-12 items-center justify-center rounded-control border border-app-border bg-app-background text-base font-bold tabular-nums text-app-foreground">
        {score ?? "–"}
      </span>
    </div>
  );
}

function getStatus(match: GuessMatchView) {
  const state = getGuessCardState(match);

  if (state === "LIVE") {
    return {
      icon: Radio,
      label: match.elapsed ? `Ao vivo · ${match.elapsed}'` : "Ao vivo",
      tone: "danger" as const
    };
  }

  if (state === "FINISHED") {
    return {
      icon: CheckCircle2,
      label: match.status === "CANCELLED" ? "Cancelada" : "Finalizada",
      tone: "neutral" as const
    };
  }

  if (state === "BLOCKED") {
    return { icon: LockKeyhole, label: "Encerrado", tone: "neutral" as const };
  }

  if (state === "SAVED") {
    return { icon: CheckCircle2, label: "Salvo", tone: "success" as const };
  }

  return { icon: Clock3, label: "Pendente", tone: "warning" as const };
}

export const GuessMatchCard = memo(function GuessMatchCard({
  highlighted,
  jokerLocked,
  legRole,
  match,
  nowMs,
  onAdvanceRequested,
  onDeleted,
  onSaved,
  roundJokerMatchId,
  roundJokerMatchName
}: GuessMatchCardProps) {
  const [expanded, setExpanded] = useState(legRole !== "VOLTA");
  const state = getGuessCardState(match);
  const status = getStatus(match);
  const StatusIcon = status.icon;
  const startingSoon = nowMs > 0 && isStartingSoon(match, nowMs);
  const remainingMs = nowMs > 0 ? new Date(match.kickoff).getTime() - nowMs : null;
  const criticalDeadline = remainingMs !== null && remainingMs > 0 && remainingMs <= 15 * 60_000;
  const showForm = match.canEdit && expanded;
  const predictionHome = match.existingGuess?.homePrediction ?? null;
  const predictionAway = match.existingGuess?.awayPrediction ?? null;
  const actualScore =
    match.homeScore !== null && match.awayScore !== null
      ? `${match.homeScore} × ${match.awayScore}`
      : null;

  return (
    <article
      className={cn(
        "guess-match-row scroll-mt-24 rounded-card border border-app-border bg-app-surface px-3 py-2.5 shadow-sm transition sm:px-4",
        state === "PENDING" ? "border-l-2 border-l-amber-500" : "",
        state === "SAVED" ? "border-l-2 border-l-emerald-500" : "",
        state === "LIVE" ? "border-l-2 border-l-red-500" : "",
        highlighted ? "bg-brand-gold/10 ring-1 ring-brand-gold" : ""
      )}
      id={`guess-match-${match.id}`}
    >
      <header className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <time className="text-xs font-bold text-app-foreground" dateTime={match.kickoff}>
          {formatGuessKickoff(match.kickoff, nowMs)}
        </time>
        {match.canEdit && startingSoon ? (
          <span
            className={cn(
              "text-xs font-semibold",
              criticalDeadline
                ? "text-red-500 dark:text-red-300"
                : "text-amber-600 dark:text-amber-300"
            )}
          >
            ⏱ {formatGuessDeadline(match.kickoff, nowMs)}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1.5">
          {legRole ? (
            <Badge tone={legRole === "IDA" ? "info" : "warning"}>
              {legRole === "IDA" ? "Ida" : "Volta"}
            </Badge>
          ) : null}
          {match.existingGuess?.joker ? (
            <Badge tone="warning">
              <Star aria-hidden className="mr-1 h-3 w-3 fill-current" />
              Coringa
            </Badge>
          ) : null}
          <Badge tone={status.tone}>
            <StatusIcon aria-hidden className="mr-1 h-3 w-3" />
            {status.label}
          </Badge>
        </span>
      </header>

      {showForm ? (
        <GuessForm
          awayTeam={match.awayTeam}
          existingGuess={match.existingGuess}
          homeTeam={match.homeTeam}
          jokerLimit={match.scoring.jokerLimitPerRound}
          jokerLocked={jokerLocked}
          leagueId={match.leagueId}
          matchId={match.id}
          matchName={`${match.homeTeam.name} x ${match.awayTeam.name}`}
          onAdvanceRequested={(matchId) => {
            if (legRole === "VOLTA") setExpanded(false);
            onAdvanceRequested(matchId);
          }}
          onDeleted={onDeleted}
          onSaved={onSaved}
          roundJokerMatchId={roundJokerMatchId}
          roundJokerMatchName={roundJokerMatchName}
          scoring={match.scoring}
        />
      ) : (
        <div className="divide-y divide-app-border">
          <TeamResultRow score={predictionHome} team={match.homeTeam} />
          <TeamResultRow score={predictionAway} team={match.awayTeam} />
        </div>
      )}

      {match.canEdit && !expanded ? (
        <button
          className="mt-2 inline-flex h-10 items-center gap-2 rounded-button border border-brand-gold/50 px-3 text-xs font-bold text-brand-gold"
          onClick={() => setExpanded(true)}
          type="button"
        >
          <Pencil aria-hidden className="h-3.5 w-3.5" />
          {legRole === "VOLTA" ? "Abrir jogo de volta" : "Editar palpite"}
        </button>
      ) : null}

      <footer className="mt-1.5 flex min-h-7 items-center gap-3 border-t border-app-border pt-1.5 text-xs text-app-muted">
        {actualScore && (state === "LIVE" || state === "FINISHED") ? (
          <span>
            Resultado: <strong className="text-app-foreground">{actualScore}</strong>
          </span>
        ) : null}
        {match.existingGuess?.score ? (
          <span className="font-semibold text-brand-gold">
            {match.existingGuess.score.totalPoints} pts
          </span>
        ) : null}
        {!match.canEdit && !match.existingGuess ? <span>Sem palpite registrado</span> : null}
        <Link
          aria-label={`Ver detalhes de ${match.homeTeam.name} e ${match.awayTeam.name}`}
          className="ml-auto inline-flex h-7 items-center gap-1 font-semibold hover:text-brand-gold"
          href={`/partidas/${match.id}`}
        >
          <ChartNoAxesCombined aria-hidden className="h-3.5 w-3.5" />
          Detalhes
        </Link>
      </footer>
    </article>
  );
});
