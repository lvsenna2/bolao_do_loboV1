"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";

import { FootballLogo } from "@/components/football/football-logo";
import { LoadingButton } from "@/components/ui/loading-button";
import { ActionAlert } from "@/features/auth/components/action-alert";
import { applyServerFieldErrors } from "@/features/auth/components/form-error-utils";
import { cn } from "@/lib/utils";
import { deleteGuessAction, upsertGuessAction } from "../actions/guess-actions";
import type { GuessView, ScoringDefaults, TeamView } from "../data/guess-data";
import {
  getPredictionFromScore,
  upsertGuessSchema,
  type UpsertGuessInput
} from "../schemas/guess-schemas";
import { GuessDialog } from "./guess-dialog";
import { ScoreInput } from "./score-input";

type GuessFormProps = {
  awayTeam: TeamView;
  existingGuess: GuessView | null;
  homeTeam: TeamView;
  jokerLimit: number;
  jokerLocked: boolean;
  leagueId: string;
  matchId: string;
  matchName: string;
  onAdvanceRequested: (matchId: string) => void;
  onDeleted: (matchId: string) => void;
  onSaved: (matchId: string, guess: GuessView) => void;
  roundJokerMatchId: string | null;
  roundJokerMatchName: string | null;
  scoring: ScoringDefaults;
};

function emptyScore() {
  return Number.NaN;
}

function hasSavedScore(existingGuess: GuessView | null) {
  return Boolean(
    existingGuess && existingGuess.homePrediction !== null && existingGuess.awayPrediction !== null
  );
}

function getDefaultValues(
  existingGuess: GuessView | null,
  matchId: string,
  leagueId: string
): UpsertGuessInput {
  const homePrediction = existingGuess?.homePrediction ?? emptyScore();
  const awayPrediction = existingGuess?.awayPrediction ?? emptyScore();
  const complete = Number.isFinite(homePrediction) && Number.isFinite(awayPrediction);

  return {
    awayPrediction,
    homePrediction,
    joker: existingGuess?.joker ?? false,
    leagueId,
    matchId,
    prediction: complete
      ? getPredictionFromScore(homePrediction, awayPrediction)
      : (existingGuess?.prediction ?? "DRAW")
  };
}

function TeamScoreRow({ children, team }: { children: React.ReactNode; team: TeamView }) {
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
      {children}
    </div>
  );
}

export function GuessForm({
  awayTeam,
  existingGuess,
  homeTeam,
  jokerLimit,
  jokerLocked,
  leagueId,
  matchId,
  matchName,
  onAdvanceRequested,
  onDeleted,
  onSaved,
  roundJokerMatchId,
  roundJokerMatchName,
  scoring
}: GuessFormProps) {
  const defaultValues = useMemo(
    () => getDefaultValues(existingGuess, matchId, leagueId),
    [existingGuess, leagueId, matchId]
  );
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [jokerDialogOpen, setJokerDialogOpen] = useState(false);
  const [saved, setSaved] = useState(hasSavedScore(existingGuess));
  const [error, setErrorMessage] = useState<string>();
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    watch
  } = useForm<UpsertGuessInput>({
    defaultValues,
    resolver: zodResolver(upsertGuessSchema)
  });

  const awayPrediction = watch("awayPrediction");
  const homePrediction = watch("homePrediction");
  const joker = watch("joker");
  const prediction = watch("prediction");
  const homeFilled = Number.isFinite(homePrediction);
  const awayFilled = Number.isFinite(awayPrediction);
  const selectingDifferentJoker = Boolean(roundJokerMatchId && roundJokerMatchId !== matchId);
  const jokerDisabled = jokerLimit < 1 || (jokerLocked && selectingDifferentJoker);

  useEffect(() => {
    reset(defaultValues);
    setSaved(hasSavedScore(existingGuess));
  }, [defaultValues, existingGuess, reset]);

  useEffect(() => {
    if (!homeFilled || !awayFilled) return;

    const nextPrediction = getPredictionFromScore(homePrediction, awayPrediction);

    if (nextPrediction !== prediction) {
      setValue("prediction", nextPrediction, { shouldDirty: true, shouldValidate: true });
    }
  }, [awayFilled, awayPrediction, homeFilled, homePrediction, prediction, setValue]);

  const onSubmit = useCallback(
    (values: UpsertGuessInput) => {
      setSaved(false);
      setErrorMessage(undefined);

      startTransition(async () => {
        const result = await upsertGuessAction(values);

        if (!result.ok) {
          setErrorMessage(result.message);
          applyServerFieldErrors(setError, result.fieldErrors);
          return;
        }

        const savedGuess = result.data?.guess;

        if (savedGuess) {
          onSaved(matchId, savedGuess);
          reset(getDefaultValues(savedGuess, matchId, leagueId));
          setSaved(true);
        }

        onAdvanceRequested(matchId);
      });
    },
    [leagueId, matchId, onAdvanceRequested, onSaved, reset, setError]
  );

  function updateScore(onChange: (value: number) => void, value: number) {
    setSaved(false);
    setErrorMessage(undefined);
    onChange(value);
  }

  function confirmJoker() {
    setJokerDialogOpen(false);
    setErrorMessage(undefined);

    if (!homeFilled || !awayFilled) {
      setErrorMessage("Complete o placar antes de confirmar o Coringa.");
      return;
    }

    setValue("joker", true, { shouldDirty: true, shouldValidate: true });
    setValue("prediction", getPredictionFromScore(homePrediction, awayPrediction), {
      shouldDirty: true,
      shouldValidate: true
    });

    window.setTimeout(() => void handleSubmit(onSubmit)(), 0);
  }

  function toggleJoker() {
    if (joker) {
      setSaved(false);
      setValue("joker", false, { shouldDirty: true, shouldValidate: true });
      return;
    }

    setJokerDialogOpen(true);
  }

  function onDelete() {
    if (!existingGuess) return;

    setErrorMessage(undefined);
    startDeleteTransition(async () => {
      const result = await deleteGuessAction({ guessId: existingGuess.id });

      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      reset(getDefaultValues(null, matchId, leagueId));
      setSaved(false);
      onDeleted(matchId);
    });
  }

  const statusLabel = isPending
    ? "Salvando..."
    : error
      ? "Erro ao salvar"
      : isDirty
        ? "Nao salvo"
        : saved
          ? "✓ Salvo"
          : "Pendente";

  return (
    <>
      <form
        className="space-y-2"
        onKeyDown={(event) => {
          if (
            event.key !== "Enter" ||
            !(event.target instanceof HTMLInputElement) ||
            !event.target.dataset.scoreInput
          ) {
            return;
          }

          const scoreInputs = Array.from(
            event.currentTarget.querySelectorAll<HTMLInputElement>("input[data-score-input]")
          );

          if (scoreInputs[0] === event.target) {
            event.preventDefault();
            scoreInputs[1]?.focus();
          }
        }}
        onSubmit={handleSubmit(onSubmit)}
      >
        <input type="hidden" {...register("matchId")} />
        <input type="hidden" {...register("leagueId")} />
        <input type="hidden" {...register("joker")} />
        <input type="hidden" {...register("prediction")} />

        <div className="divide-y divide-app-border">
          <TeamScoreRow team={homeTeam}>
            <Controller
              control={control}
              name="homePrediction"
              render={({ field }) => (
                <ScoreInput
                  ariaLabel={`Gols de ${homeTeam.name}`}
                  invalid={Boolean(errors.homePrediction)}
                  onChange={(value) => updateScore(field.onChange, value)}
                  value={field.value}
                />
              )}
            />
          </TeamScoreRow>
          <TeamScoreRow team={awayTeam}>
            <Controller
              control={control}
              name="awayPrediction"
              render={({ field }) => (
                <ScoreInput
                  ariaLabel={`Gols de ${awayTeam.name}`}
                  invalid={Boolean(errors.awayPrediction)}
                  onChange={(value) => updateScore(field.onChange, value)}
                  value={field.value}
                />
              )}
            />
          </TeamScoreRow>
        </div>

        {errors.homePrediction?.message || errors.awayPrediction?.message ? (
          <p className="text-xs text-red-600 dark:text-red-300">
            {errors.homePrediction?.message ?? errors.awayPrediction?.message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-app-border pt-2">
          <LoadingButton
            className="h-10 rounded-button bg-brand-gold px-3 text-xs font-bold text-slate-950 hover:bg-amber-400"
            disabled={isDeleting || (!isDirty && Boolean(existingGuess))}
            icon={<Save aria-hidden className="h-4 w-4" />}
            isLoading={isPending}
            loadingLabel="Salvando..."
            type="submit"
          >
            Salvar
          </LoadingButton>
          <button
            aria-label={joker ? "Remover Coringa" : "Usar Coringa nesta partida"}
            aria-pressed={Boolean(joker)}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-button border px-3 text-xs font-semibold",
              joker
                ? "border-brand-gold bg-brand-gold/10 text-brand-gold"
                : "border-app-border text-app-muted hover:border-brand-gold",
              jokerDisabled ? "cursor-not-allowed opacity-50" : ""
            )}
            disabled={jokerDisabled}
            onClick={toggleJoker}
            type="button"
          >
            <Star aria-hidden className={cn("h-4 w-4", joker ? "fill-current" : "")} />
            Coringa
          </button>
          {existingGuess ? (
            <LoadingButton
              aria-label="Excluir palpite"
              className="h-10 w-10 rounded-button border border-app-border text-app-muted hover:border-brand-red hover:text-brand-red"
              disabled={isPending}
              icon={<Trash2 aria-hidden className="h-4 w-4" />}
              isLoading={isDeleting}
              loadingLabel=""
              onClick={onDelete}
              type="button"
            />
          ) : null}
          <span
            aria-live="polite"
            className={cn(
              "ml-auto text-xs font-semibold",
              error
                ? "text-red-600 dark:text-red-300"
                : isDirty
                  ? "text-amber-600 dark:text-amber-300"
                  : saved
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-app-muted"
            )}
          >
            {statusLabel}
          </span>
        </div>

        <ActionAlert message={error} />
      </form>

      <GuessDialog
        footer={
          <>
            <button
              className="h-11 rounded-button border border-app-border px-4 text-sm font-semibold text-app-foreground hover:border-brand-gold"
              onClick={() => setJokerDialogOpen(false)}
              type="button"
            >
              {selectingDifferentJoker ? "Manter Coringa atual" : "Cancelar"}
            </button>
            <button
              className="h-11 rounded-button bg-brand-gold px-4 text-sm font-bold text-slate-950 hover:bg-amber-400"
              onClick={confirmJoker}
              type="button"
            >
              {selectingDifferentJoker ? "Trocar Coringa" : "Confirmar Coringa"}
            </button>
          </>
        }
        onClose={() => setJokerDialogOpen(false)}
        open={jokerDialogOpen}
        title={
          selectingDifferentJoker
            ? "Voce ja escolheu um Coringa nesta rodada"
            : "Utilizar o Coringa nesta partida?"
        }
      >
        {selectingDifferentJoker ? (
          <p>
            O Coringa esta em <strong className="text-app-foreground">{roundJokerMatchName}</strong>
            . Deseja transferi-lo para <strong className="text-app-foreground">{matchName}</strong>?
          </p>
        ) : (
          <p>
            Voce possui apenas um Coringa nesta rodada. A pontuacao de
            <strong className="text-app-foreground"> {matchName}</strong> sera multiplicada por{" "}
            {scoring.jokerMultiplier}.
          </p>
        )}
      </GuessDialog>
    </>
  );
}
