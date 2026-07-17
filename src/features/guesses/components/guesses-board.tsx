"use client";

import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  HelpCircle,
  ListChecks,
  LockKeyhole,
  Star,
  type LucideIcon
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GuessMatchView, GuessRoundView, GuessView } from "../data/guess-data";
import {
  getGuessCardState,
  hasCompleteGuess,
  matchesGuessFilter,
  type GuessQuickFilter
} from "../guess-status";
import { GuessDialog } from "./guess-dialog";
import type { GuessDraftState } from "./guess-form";
import { GuessMatchCard } from "./guess-match-card";

type GuessesBoardProps = {
  initialRounds: GuessRoundView[];
};

type FilterOption = {
  icon: LucideIcon;
  label: string;
  value: GuessQuickFilter;
};

const filters: FilterOption[] = [
  { icon: ListChecks, label: "Todos", value: "ALL" },
  { icon: CircleAlert, label: "Pendentes", value: "PENDING" },
  { icon: CheckCircle2, label: "Realizados", value: "SAVED" },
  { icon: Clock3, label: "Proximos", value: "STARTING_SOON" },
  { icon: Clock3, label: "Ao vivo", value: "LIVE" },
  { icon: LockKeyhole, label: "Encerrados", value: "FINISHED" }
];

function sameDraftState(left: GuessDraftState | undefined, right: GuessDraftState) {
  return (
    left?.awayFilled === right.awayFilled &&
    left?.homeFilled === right.homeFilled &&
    left?.incomplete === right.incomplete &&
    left?.isDirty === right.isDirty
  );
}

function SectionTitle({ count, title }: { count: number; title: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-app-foreground">{title}</h2>
      <Badge tone={count > 0 ? "info" : "neutral"}>{count}</Badge>
    </div>
  );
}

export function GuessesBoard({ initialRounds }: GuessesBoardProps) {
  const [rounds, setRounds] = useState(initialRounds);
  const [selectedRoundId, setSelectedRoundId] = useState(initialRounds[0]?.id ?? "");
  const [filter, setFilter] = useState<GuessQuickFilter>("ALL");
  const [draftStates, setDraftStates] = useState<Record<string, GuessDraftState>>({});
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

  const selectedRound = useMemo(
    () => rounds.find((round) => round.id === selectedRoundId) ?? rounds[0] ?? null,
    [rounds, selectedRoundId]
  );
  const matches = useMemo(() => selectedRound?.matches ?? [], [selectedRound]);
  const pendingMatches = matches.filter((match) => getGuessCardState(match) === "PENDING");
  const submittedCount = matches.filter(hasCompleteGuess).length;
  const blockedCount = matches.filter((match) => !match.canEdit).length;
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
  const visiblePending = visibleMatches.filter((match) => getGuessCardState(match) === "PENDING");
  const visibleSaved = visibleMatches.filter((match) => getGuessCardState(match) === "SAVED");
  const visibleClosed = visibleMatches.filter((match) =>
    ["BLOCKED", "FINISHED", "LIVE"].includes(getGuessCardState(match))
  );

  const focusMatch = useCallback((matchId: string) => {
    setHighlightedMatchId(matchId);
    window.setTimeout(() => {
      const card = document.getElementById(`guess-match-${matchId}`);
      card?.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstEmptyInput = card?.querySelector<HTMLInputElement>(
        "input[data-score-input]:placeholder-shown"
      );
      (firstEmptyInput ?? card?.querySelector<HTMLInputElement>("input[data-score-input]"))?.focus();
    }, 50);
    window.setTimeout(() => setHighlightedMatchId(null), 1_800);
  }, []);

  useEffect(() => {
    if (!advanceAfterSave) return;

    const nextPending = pendingMatches.find((match) => match.id !== advanceAfterSave);
    setAdvanceAfterSave(null);
    if (nextPending) focusMatch(nextPending.id);
  }, [advanceAfterSave, focusMatch, pendingMatches]);

  const handleDraftStateChange = useCallback((matchId: string, state: GuessDraftState) => {
    setDraftStates((current) => {
      if (sameDraftState(current[matchId], state)) return current;

      return { ...current, [matchId]: state };
    });
  }, []);

  const handleSaved = useCallback((matchId: string, guess: GuessView) => {
    setRounds((current) =>
      current.map((round) => {
        if (!round.matches.some((match) => match.id === matchId)) return round;

        const updatedMatches = round.matches.map((match) => {
          if (match.id === matchId) return { ...match, existingGuess: guess };
          if (guess.joker && match.existingGuess?.joker) {
            return {
              ...match,
              existingGuess: { ...match.existingGuess, joker: false }
            };
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
    setDraftStates((current) => {
      const next = { ...current };
      delete next[matchId];
      return next;
    });
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

  const renderCards = (items: GuessMatchView[]) => (
    <div className="grid gap-5 xl:grid-cols-2">
      {items.map((match) => (
        <GuessMatchCard
          draftState={draftStates[match.id]}
          highlighted={highlightedMatchId === match.id}
          jokerLocked={jokerLocked}
          key={match.id}
          match={match}
          nowMs={nowMs}
          onAdvanceRequested={handleAdvanceRequested}
          onDeleted={handleDeleted}
          onDraftStateChange={handleDraftStateChange}
          onSaved={handleSaved}
          roundJokerMatchId={jokerMatch?.id ?? null}
          roundJokerMatchName={
            jokerMatch ? `${jokerMatch.homeTeam.name} x ${jokerMatch.awayTeam.name}` : null
          }
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {rounds.length > 1 ? (
        <label className="block max-w-xl space-y-2">
          <span className="text-sm font-semibold text-app-foreground">Liga e rodada</span>
          <span className="relative block">
            <select
              className="h-12 w-full appearance-none rounded-control border border-app-border bg-app-surface px-4 pr-10 text-sm font-semibold text-app-foreground outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
              onChange={(event) => {
                setSelectedRoundId(event.target.value);
                setFilter("ALL");
              }}
              value={selectedRound.id}
            >
              {rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.leagueName} - {round.label}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted"
            />
          </span>
        </label>
      ) : null}

      <section className="overflow-hidden rounded-card border border-app-border bg-app-surface shadow-soft">
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase text-brand-gold">{selectedRound.leagueName}</p>
            <h2 className="mt-1 text-xl font-bold text-app-foreground">{selectedRound.label}</h2>
            <p className="mt-1 text-sm text-app-muted">{selectedRound.championshipName}</p>
          </div>
          {pendingMatches.length > 0 ? (
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-bold text-slate-950 hover:bg-amber-400"
              onClick={() => focusMatch(pendingMatches[0].id)}
              type="button"
            >
              <CircleAlert aria-hidden className="h-4 w-4" />
              Ir para o proximo pendente
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 border-y border-app-border sm:grid-cols-5">
          {[
            ["Jogos", matches.length],
            ["Realizados", submittedCount],
            ["Pendentes", pendingMatches.length],
            ["Bloqueados", blockedCount],
            ["Concluido", `${completion}%`]
          ].map(([label, value]) => (
            <div className="border-b border-r border-app-border p-4 last:border-r-0 sm:border-b-0" key={label}>
              <p className="text-xs font-semibold uppercase text-app-muted">{label}</p>
              <p className="mt-1 text-xl font-black text-app-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="p-5">
          <div
            aria-label={`${completion}% dos palpites concluidos`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={completion}
            className="h-3 overflow-hidden rounded-full bg-app-background"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-brand-gold transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${completion}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-app-muted">
            Palpites da rodada: {submittedCount} de {matches.length} concluidos. Faltam {" "}
            {pendingMatches.length}.
          </p>
        </div>
      </section>

      <section
        className={cn(
          "rounded-card border p-4 sm:p-5",
          jokerMatch
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-amber-500/40 bg-amber-500/10"
        )}
      >
        <div className="flex items-start gap-3">
          <Star
            aria-hidden
            className={cn(
              "mt-0.5 h-5 w-5 shrink-0",
              jokerMatch ? "fill-emerald-400 text-emerald-400" : "fill-brand-gold text-brand-gold"
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-app-foreground">Coringa da Rodada</h2>
              <button
                aria-label="Como funciona o Coringa"
                className="inline-flex h-8 w-8 items-center justify-center rounded-control text-app-muted hover:bg-app-elevated hover:text-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
                onClick={() => setHelpOpen(true)}
                type="button"
              >
                <HelpCircle aria-hidden className="h-4 w-4" />
              </button>
            </div>
            {jokerMatch ? (
              <p className="mt-1 text-sm text-app-muted">
                Coringa utilizado em <strong className="text-app-foreground">
                  {jokerMatch.homeTeam.name} x {jokerMatch.awayTeam.name}
                </strong>
                {jokerLocked ? ". A escolha esta bloqueada." : ". Voce ainda pode troca-lo."}
              </p>
            ) : (
              <p className="mt-1 text-sm text-app-muted">
                Voce possui apenas <strong className="text-app-foreground">1 Coringa</strong>. Use-o
                com estrategia para multiplicar a pontuacao de uma partida.
              </p>
            )}
            {allEditableCompleted && !jokerMatch ? (
              <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-amber-200">
                <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                Todos os palpites foram preenchidos, mas o Coringa ainda nao foi escolhido.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <nav aria-label="Filtros de palpites" className="overflow-x-auto pb-1">
        <div className="flex w-max min-w-full gap-2">
          {filters.map((option) => {
            const Icon = option.icon;
            return (
              <button
                aria-pressed={filter === option.value}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-button border px-3 text-sm font-semibold transition",
                  filter === option.value
                    ? "border-brand-gold bg-brand-gold text-slate-950"
                    : "border-app-border bg-app-surface text-app-muted hover:border-brand-gold hover:text-app-foreground"
                )}
                key={option.value}
                onClick={() => setFilter(option.value)}
                type="button"
              >
                <Icon aria-hidden className="h-4 w-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      </nav>

      {visibleMatches.length === 0 ? (
        <div className="rounded-card border border-dashed border-app-border bg-app-surface p-8 text-center">
          <p className="font-semibold text-app-foreground">Nenhuma partida neste filtro.</p>
          <p className="mt-1 text-sm text-app-muted">Selecione outro filtro para continuar.</p>
        </div>
      ) : null}

      {visiblePending.length > 0 ? (
        <section className="space-y-4">
          <SectionTitle count={visiblePending.length} title="Ainda falta palpitar" />
          {renderCards(visiblePending)}
        </section>
      ) : null}

      {visibleSaved.length > 0 ? (
        <details className="group space-y-4" open={filter === "SAVED" ? true : undefined}>
          <summary className="cursor-pointer list-none rounded-control border border-app-border bg-app-surface p-4 marker:hidden">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle count={visibleSaved.length} title="Palpites realizados" />
              <ChevronDown
                aria-hidden
                className="h-5 w-5 text-app-muted transition group-open:rotate-180"
              />
            </div>
          </summary>
          <div className="pt-4">{renderCards(visibleSaved)}</div>
        </details>
      ) : null}

      {visibleClosed.length > 0 ? (
        <section className="space-y-4">
          <SectionTitle count={visibleClosed.length} title="Bloqueados e encerrados" />
          {renderCards(visibleClosed)}
        </section>
      ) : null}

      {pendingMatches.length === 0 && submittedCount > 0 ? (
        <div className="flex items-start gap-3 rounded-card border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Todos os seus palpites editaveis desta rodada estao prontos.</p>
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
