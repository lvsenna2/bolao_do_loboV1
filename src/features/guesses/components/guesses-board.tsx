"use client";

import { CheckCircle2, ChevronDown, CircleAlert, HelpCircle, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { identifyTwoLegMatches } from "@/features/matches/two-leg";
import { cn } from "@/lib/utils";
import type { GuessMatchView, GuessRoundView, GuessView } from "../data/guess-data";
import {
  getGuessCardState,
  hasCompleteGuess,
  matchesGuessFilter,
  type GuessQuickFilter
} from "../guess-status";
import { GuessDialog } from "./guess-dialog";
import { GuessMatchCard } from "./guess-match-card";

type GuessesBoardProps = {
  initialRounds: GuessRoundView[];
};

type LiveScoreUpdate = Pick<
  GuessMatchView,
  "awayScore" | "elapsed" | "homeScore" | "id" | "status"
>;

const filters: Array<{ label: string; value: GuessQuickFilter }> = [
  { label: "Todos", value: "ALL" },
  { label: "Pendentes", value: "PENDING" },
  { label: "Salvos", value: "SAVED" },
  { label: "Proximos", value: "STARTING_SOON" },
  { label: "Ao vivo", value: "LIVE" },
  { label: "Encerrados", value: "FINISHED" }
];

export function GuessesBoard({ initialRounds }: GuessesBoardProps) {
  const [rounds, setRounds] = useState(initialRounds);
  const [selectedRoundId, setSelectedRoundId] = useState(initialRounds[0]?.id ?? "");
  const [filter, setFilter] = useState<GuessQuickFilter>("ALL");
  const [highlightedMatchId, setHighlightedMatchId] = useState<string | null>(null);
  const [advanceAfterSave, setAdvanceAfterSave] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const updateNow = () => setNowMs(Date.now());
    updateNow();
    const interval = window.setInterval(updateNow, 30_000);

    return () => window.clearInterval(interval);
  }, []);

  const shouldPollLiveScores = useMemo(() => {
    const currentTime = nowMs || Date.now();

    return rounds.some((round) =>
      round.matches.some((match) => {
        if (["LIVE", "HALFTIME", "SUSPENDED"].includes(match.status)) return true;
        if (match.status !== "SCHEDULED") return false;

        const untilKickoff = new Date(match.kickoff).getTime() - currentTime;
        return untilKickoff <= 30 * 60_000 && untilKickoff >= -6 * 60 * 60_000;
      })
    );
  }, [nowMs, rounds]);

  useEffect(() => {
    if (!shouldPollLiveScores) return;

    let cancelled = false;

    async function refreshLiveScores() {
      if (document.visibilityState !== "visible") return;

      try {
        const response = await fetch("/api/football/live-scores");
        if (!response.ok || cancelled) return;

        const payload = (await response.json()) as { matches: LiveScoreUpdate[] };
        const updates = new Map(payload.matches.map((match) => [match.id, match]));

        setRounds((current) =>
          current.map((round) => ({
            ...round,
            matches: round.matches.map((match) => {
              const update = updates.get(match.id);
              if (!update) return match;

              return {
                ...match,
                awayScore: update.awayScore,
                canEdit:
                  match.canEdit &&
                  update.status === "SCHEDULED" &&
                  new Date(match.kickoff).getTime() > Date.now(),
                elapsed: update.elapsed,
                homeScore: update.homeScore,
                status: update.status
              };
            })
          }))
        );
      } catch {
        // Conteudo inicial continua utilizavel quando atualizacao ao vivo falha.
      }
    }

    void refreshLiveScores();
    const interval = window.setInterval(refreshLiveScores, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [shouldPollLiveScores]);

  const selectedRound = useMemo(
    () => rounds.find((round) => round.id === selectedRoundId) ?? rounds[0] ?? null,
    [rounds, selectedRoundId]
  );
  const matches = useMemo(() => selectedRound?.matches ?? [], [selectedRound]);
  const legRoles = useMemo(() => identifyTwoLegMatches(matches), [matches]);
  const pendingMatches = matches.filter((match) => getGuessCardState(match) === "PENDING");
  const submittedCount = matches.filter(hasCompleteGuess).length;
  const completion = matches.length > 0 ? Math.round((submittedCount / matches.length) * 100) : 0;
  const jokerMatch = matches.find((match) => match.existingGuess?.joker) ?? null;
  const jokerLocked = Boolean(jokerMatch && !jokerMatch.canEdit);
  const allEditableCompleted =
    matches.some((match) => match.canEdit) &&
    matches.filter((match) => match.canEdit).every(hasCompleteGuess);
  const visibleMatches = useMemo(
    () => matches.filter((match) => matchesGuessFilter(match, filter, nowMs)),
    [filter, matches, nowMs]
  );

  const focusMatch = useCallback((matchId: string) => {
    setHighlightedMatchId(matchId);
    window.setTimeout(() => {
      const row = document.getElementById(`guess-match-${matchId}`);
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
      row?.querySelector<HTMLInputElement>("input[data-score-input]")?.focus();
    }, 50);
    window.setTimeout(() => setHighlightedMatchId(null), 1_200);
  }, []);

  useEffect(() => {
    if (!advanceAfterSave) return;

    const nextPending = pendingMatches.find((match) => match.id !== advanceAfterSave);
    setAdvanceAfterSave(null);
    if (nextPending) focusMatch(nextPending.id);
  }, [advanceAfterSave, focusMatch, pendingMatches]);

  const handleSaved = useCallback((matchId: string, guess: GuessView) => {
    setRounds((current) =>
      current.map((round) => {
        if (!round.matches.some((match) => match.id === matchId)) return round;

        const updatedMatches = round.matches.map((match) => {
          if (match.id === matchId) return { ...match, existingGuess: guess };
          if (guess.joker && match.existingGuess?.joker) {
            return { ...match, existingGuess: { ...match.existingGuess, joker: false } };
          }

          return match;
        });
        const nextJoker = updatedMatches.find((match) => match.existingGuess?.joker) ?? null;

        return {
          ...round,
          jokerMatchId: nextJoker?.id ?? null,
          jokerMatchName: nextJoker
            ? `${nextJoker.homeTeam.name} x ${nextJoker.awayTeam.name}`
            : null,
          matches: updatedMatches,
          usedJokers: nextJoker ? 1 : 0
        };
      })
    );
  }, []);

  const handleDeleted = useCallback((matchId: string) => {
    setRounds((current) =>
      current.map((round) => ({
        ...round,
        jokerMatchId: round.jokerMatchId === matchId ? null : round.jokerMatchId,
        jokerMatchName: round.jokerMatchId === matchId ? null : round.jokerMatchName,
        matches: round.matches.map((match) =>
          match.id === matchId ? { ...match, existingGuess: null } : match
        ),
        usedJokers: round.jokerMatchId === matchId ? 0 : round.usedJokers
      }))
    );
  }, []);

  const handleAdvanceRequested = useCallback((matchId: string) => {
    setAdvanceAfterSave(matchId);
  }, []);

  if (!selectedRound) return null;

  return (
    <div className="space-y-3">
      {rounds.length > 1 ? (
        <label className="relative block">
          <span className="sr-only">Liga e rodada</span>
          <select
            className="h-11 w-full appearance-none rounded-control border border-app-border bg-app-surface px-3 pr-9 text-sm font-semibold text-app-foreground outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
            onChange={(event) => {
              setSelectedRoundId(event.target.value);
              setFilter("ALL");
            }}
            value={selectedRound.id}
          >
            {rounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.leagueName} · {round.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted"
          />
        </label>
      ) : null}

      <section className="rounded-card border border-app-border bg-app-surface p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase text-brand-gold">
              {selectedRound.leagueName} · {selectedRound.championshipName}
            </p>
            <h2 className="mt-0.5 truncate text-lg font-bold text-app-foreground">
              {selectedRound.label}
            </h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-app-foreground">
              {submittedCount}/{matches.length} preenchidos
            </p>
            <p className="text-xs text-app-muted">{completion}% concluido</p>
          </div>
        </div>
        <div
          aria-label={`${completion}% dos palpites concluidos`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={completion}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-app-background"
          role="progressbar"
        >
          <div className="h-full bg-brand-gold" style={{ width: `${completion}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-app-border pt-2.5 text-xs">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-app-muted">
            <Star
              aria-hidden
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-brand-gold",
                jokerMatch ? "fill-current" : ""
              )}
            />
            <span className="truncate">
              {jokerMatch
                ? `Coringa: ${jokerMatch.homeTeam.name} x ${jokerMatch.awayTeam.name}`
                : "Coringa ainda nao escolhido"}
            </span>
          </span>
          <button
            aria-label="Como funciona o Coringa"
            className="inline-flex h-8 w-8 items-center justify-center rounded-control text-app-muted hover:bg-app-elevated hover:text-brand-gold"
            onClick={() => setHelpOpen(true)}
            type="button"
          >
            <HelpCircle aria-hidden className="h-4 w-4" />
          </button>
          {pendingMatches.length > 0 ? (
            <button
              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-button bg-brand-gold px-2.5 font-bold text-slate-950"
              onClick={() => focusMatch(pendingMatches[0].id)}
              type="button"
            >
              <CircleAlert aria-hidden className="h-3.5 w-3.5" />
              Proximo pendente
            </button>
          ) : null}
        </div>
        {allEditableCompleted && !jokerMatch ? (
          <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-300">
            Palpites completos; falta escolher o Coringa.
          </p>
        ) : null}
      </section>

      <nav aria-label="Filtros de palpites" className="flex flex-wrap gap-1.5">
        {filters.map((option) => (
          <button
            aria-pressed={filter === option.value}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold",
              filter === option.value
                ? "border-brand-gold bg-brand-gold text-slate-950"
                : "border-app-border bg-app-surface text-app-muted hover:border-brand-gold"
            )}
            key={option.value}
            onClick={() => setFilter(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </nav>

      {visibleMatches.length > 0 ? (
        <section aria-label="Partidas" className="grid gap-2 lg:grid-cols-2">
          {visibleMatches.map((match) => (
            <GuessMatchCard
              highlighted={highlightedMatchId === match.id}
              jokerLocked={jokerLocked}
              key={match.id}
              legRole={legRoles.get(match.id)}
              match={match}
              nowMs={nowMs}
              onAdvanceRequested={handleAdvanceRequested}
              onDeleted={handleDeleted}
              onSaved={handleSaved}
              roundJokerMatchId={jokerMatch?.id ?? null}
              roundJokerMatchName={
                jokerMatch ? `${jokerMatch.homeTeam.name} x ${jokerMatch.awayTeam.name}` : null
              }
            />
          ))}
        </section>
      ) : (
        <div className="rounded-card border border-dashed border-app-border bg-app-surface p-6 text-center">
          <p className="text-sm font-semibold text-app-foreground">Nenhuma partida neste filtro.</p>
        </div>
      )}

      {pendingMatches.length === 0 && submittedCount > 0 ? (
        <div className="flex items-center gap-2 rounded-card border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-200">
          <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0" />
          Todos os palpites editaveis desta rodada estao prontos.
        </div>
      ) : null}

      <GuessDialog
        footer={
          <button
            className="h-11 rounded-button bg-brand-gold px-4 text-sm font-bold text-slate-950 hover:bg-amber-400"
            onClick={() => setHelpOpen(false)}
            type="button"
          >
            Entendi
          </button>
        }
        onClose={() => setHelpOpen(false)}
        open={helpOpen}
        title="Como funciona o Coringa"
      >
        <ul className="space-y-2">
          <li>O Coringa pode ser usado apenas uma vez por rodada.</li>
          <li>Ele multiplica a pontuacao obtida naquela partida.</li>
          <li>E possivel troca-lo enquanto a partida escolhida ainda nao comecou.</li>
          <li>Depois do inicio da partida, a escolha fica bloqueada.</li>
        </ul>
      </GuessDialog>
    </div>
  );
}
