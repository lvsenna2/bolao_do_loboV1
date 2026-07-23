"use client";

/* eslint-disable @next/next/no-img-element */
import {
  ChevronDown,
  CircleCheck,
  Clock3,
  EyeOff,
  ListFilter,
  LockKeyhole,
  Radio,
  Trophy,
  type LucideIcon
} from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";
import { getTeamLogoSrc } from "@/lib/team-logo";
import { cn } from "@/lib/utils";
import type {
  ComparisonGuessView,
  GuessComparisonMatchView,
  GuessComparisonRoundView
} from "../data/comparison-data";

type ComparisonFilter = "ALL" | "FINISHED" | "LIVE" | "RELEASED" | "WAITING";

type ComparisonBoardProps = {
  initialRounds: GuessComparisonRoundView[];
};

type FilterOption = {
  icon: LucideIcon;
  label: string;
  value: ComparisonFilter;
};

const filters: FilterOption[] = [
  { icon: ListFilter, label: "Todos", value: "ALL" },
  { icon: CircleCheck, label: "Liberados", value: "RELEASED" },
  { icon: EyeOff, label: "Aguardando", value: "WAITING" },
  { icon: Radio, label: "Ao vivo", value: "LIVE" },
  { icon: LockKeyhole, label: "Encerrados", value: "FINISHED" }
];

function getScoreLabel(guess: ComparisonGuessView) {
  if (guess.homePrediction === null || guess.awayPrediction === null) {
    return "Sem placar";
  }

  return `${guess.homePrediction} x ${guess.awayPrediction}`;
}

function getPredictionLabel(prediction: ComparisonGuessView["prediction"]) {
  const labels = {
    AWAY: "Visitante",
    DRAW: "Empate",
    HOME: "Mandante"
  } satisfies Record<ComparisonGuessView["prediction"], string>;

  return labels[prediction];
}

function matchesFilter(match: GuessComparisonMatchView, filter: ComparisonFilter) {
  if (filter === "ALL") return true;
  if (filter === "RELEASED") return match.isVisible;
  if (filter === "WAITING") return !match.isVisible;
  if (filter === "LIVE") return match.status === "LIVE" || match.status === "HALFTIME";

  return match.status === "FINISHED" || match.status === "CANCELLED";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function TeamMark({ apiId, logo, name, shortName }: GuessComparisonMatchView["homeTeam"]) {
  const logoSrc = getTeamLogoSrc({ apiId, logo });

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span
        aria-label={name}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-elevated text-xs font-semibold text-app-foreground"
        role="img"
      >
        {logoSrc ? (
          <img
            alt=""
            className="h-8 w-8 object-contain"
            referrerPolicy="no-referrer"
            src={logoSrc}
          />
        ) : (
          getInitials(shortName || name)
        )}
      </span>
      <span className="truncate text-sm font-semibold text-app-foreground">
        {shortName || name}
      </span>
    </div>
  );
}

function ComparisonMatchCard({ match }: { match: GuessComparisonMatchView }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <TeamMark {...match.homeTeam} />
            <span className="text-xs font-semibold text-app-muted">X</span>
            <div className="flex justify-end">
              <TeamMark {...match.awayTeam} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardDescription>{formatDateTimeInSaoPaulo(match.kickoff)}</CardDescription>
            <div className="flex flex-wrap gap-2">
              <Badge>{match.status}</Badge>
              <Badge tone={match.isVisible ? "success" : "warning"}>
                {match.isVisible ? "Comparacao liberada" : "Oculto ate iniciar"}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!match.isVisible && match.hiddenGuessCount > 0 ? (
          <div className="mb-4 flex items-start gap-2 rounded-control border border-brand-gold/30 bg-brand-gold/10 p-3 text-sm text-app-foreground">
            <EyeOff aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
            <span>
              {match.hiddenGuessCount}{" "}
              {match.hiddenGuessCount === 1 ? "palpite sera exibido" : "palpites serao exibidos"}{" "}
              depois do inicio da partida.
            </span>
          </div>
        ) : null}

        {match.guesses.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {match.guesses.map((guess) => (
              <article
                className="rounded-control border border-app-border bg-app-background p-3"
                key={guess.id}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={guess.user.name} src={guess.user.avatarUrl} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-app-foreground">{guess.user.name}</p>
                    <p className="truncate text-xs text-app-muted">@{guess.user.username}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xl font-semibold text-app-foreground">
                    {getScoreLabel(guess)}
                  </span>
                  <Badge tone="info">{getPredictionLabel(guess.prediction)}</Badge>
                  {guess.joker ? <Badge tone="warning">Coringa</Badge> : null}
                  {guess.score ? (
                    <Badge tone={guess.score.totalPoints > 0 ? "success" : "neutral"}>
                      {guess.score.totalPoints} pts
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-app-muted">
                  Enviado em {formatDateTimeInSaoPaulo(guess.submittedAt)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description={
              match.isVisible
                ? "Nenhum participante ativo registrou palpite nesta partida."
                : match.ownGuess
                  ? "Os demais palpites aparecerao depois do inicio da partida."
                  : "Nenhum palpite visivel para esta partida."
            }
            icon={Trophy}
            title="Sem palpites visiveis"
          />
        )}
      </CardContent>
    </Card>
  );
}

export function ComparisonBoard({ initialRounds }: ComparisonBoardProps) {
  const [selectedRoundId, setSelectedRoundId] = useState(initialRounds[0]?.id ?? "");
  const [filter, setFilter] = useState<ComparisonFilter>("ALL");
  const selectedRound =
    initialRounds.find((round) => round.id === selectedRoundId) ?? initialRounds[0] ?? null;
  const visibleMatches = useMemo(
    () => selectedRound?.matches.filter((match) => matchesFilter(match, filter)) ?? [],
    [filter, selectedRound]
  );

  if (!selectedRound) {
    return (
      <EmptyState
        description="Ainda nao existem rodadas com palpites para esta liga."
        icon={Trophy}
        title="Nada para comparar"
      />
    );
  }

  const releasedCount = selectedRound.matches.filter((match) => match.isVisible).length;
  const waitingCount = selectedRound.matches.length - releasedCount;

  return (
    <div className="space-y-5">
      <label className="block max-w-xl space-y-2">
        <span className="text-sm font-semibold text-app-foreground">Rodada</span>
        <span className="relative block">
          <select
            className="h-12 w-full appearance-none rounded-control border border-app-border bg-app-surface px-4 pr-10 text-sm font-semibold text-app-foreground outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
            onChange={(event) => {
              setSelectedRoundId(event.target.value);
              setFilter("ALL");
            }}
            value={selectedRound.id}
          >
            {initialRounds.map((round) => (
              <option key={round.id} value={round.id}>
                {round.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted"
          />
        </span>
      </label>

      <section className="overflow-hidden rounded-card border border-app-border bg-app-surface">
        <div className="p-5">
          <p className="text-xs font-semibold uppercase text-brand-gold">
            {selectedRound.leagueName}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-app-foreground">{selectedRound.label}</h2>
          <p className="mt-1 text-sm text-app-muted">{selectedRound.championshipName}</p>
        </div>
        <div className="grid grid-cols-3 border-t border-app-border">
          {[
            ["Partidas", selectedRound.matches.length],
            ["Liberadas", releasedCount],
            ["Aguardando", waitingCount]
          ].map(([label, value]) => (
            <div className="border-r border-app-border p-4 last:border-r-0" key={label}>
              <p className="text-xs font-medium uppercase text-app-muted">{label}</p>
              <p className="mt-1 text-xl font-semibold text-app-foreground">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <nav aria-label="Filtros de comparacao" className="overflow-x-auto pb-1">
        <div className="flex w-max min-w-full gap-2">
          {filters.map((option) => {
            const Icon = option.icon;

            return (
              <button
                aria-pressed={filter === option.value}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-button border px-3 text-sm font-medium transition",
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

      {visibleMatches.length > 0 ? (
        <div className="grid gap-5">
          {visibleMatches.map((match) => (
            <ComparisonMatchCard key={match.id} match={match} />
          ))}
        </div>
      ) : (
        <EmptyState
          description="Selecione outro filtro ou outra rodada."
          icon={Clock3}
          title="Nenhuma partida neste filtro"
        />
      )}
    </div>
  );
}
