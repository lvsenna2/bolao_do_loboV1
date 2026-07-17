"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Star, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { LoadingButton } from "@/components/ui/loading-button";
import { ActionAlert } from "@/features/auth/components/action-alert";
import { applyServerFieldErrors } from "@/features/auth/components/form-error-utils";
import { cn } from "@/lib/utils";
import { deleteGuessAction, upsertGuessAction } from "../actions/guess-actions";
import type { GuessView, ScoringDefaults } from "../data/guess-data";
import {
  getPredictionFromScore,
  upsertGuessSchema,
  type GuessPrediction,
  type UpsertGuessInput
} from "../schemas/guess-schemas";
import { GuessDialog } from "./guess-dialog";

export type GuessDraftState = {
  awayFilled: boolean;
  homeFilled: boolean;
  incomplete: boolean;
  isDirty: boolean;
};

type GuessFormProps = {
  existingGuess: GuessView | null;
  jokerLimit: number;
  jokerLocked: boolean;
  leagueId: string;
  matchId: string;
  matchName: string;
  onAdvanceRequested: (matchId: string) => void;
  onDeleted: (matchId: string) => void;
  onDraftStateChange: (matchId: string, state: GuessDraftState) => void;
  onSaved: (matchId: string, guess: GuessView) => void;
  roundJokerMatchId: string | null;
  roundJokerMatchName: string | null;
  scoring: ScoringDefaults;
};

const predictionOptions = [
  { helper: "Mandante", label: "1", value: "HOME" },
  { helper: "Empate", label: "X", value: "DRAW" },
  { helper: "Visitante", label: "2", value: "AWAY" }
] satisfies Array<{ helper: string; label: string; value: GuessPrediction }>;

function emptyScore() {
  return undefined as unknown as number;
}

function getDefaultValues(
  existingGuess: GuessView | null,
  matchId: string,
  leagueId: string
): UpsertGuessInput {
  const hasSavedScore = Boolean(
    existingGuess &&
      existingGuess.homePrediction !== null &&
      existingGuess.awayPrediction !== null
  );
  const homePrediction = existingGuess?.homePrediction ?? emptyScore();
  const awayPrediction = existingGuess?.awayPrediction ?? emptyScore();

  return {
    awayPrediction: awayPrediction as number,
    homePrediction: homePrediction as number,
    joker: existingGuess?.joker ?? false,
    leagueId,
    matchId,
    prediction: hasSavedScore
      ? getPredictionFromScore(homePrediction as number, awayPrediction as number)
      : (existingGuess?.prediction ?? "DRAW")
  };
}

function isFilledScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function getPointsPreview(scoring: ScoringDefaults, joker: boolean) {
  const basePoints = scoring.winnerHit + scoring.exactScoreBonus;

  return joker ? basePoints * scoring.jokerMultiplier : basePoints;
}

export function GuessForm({
  existingGuess,
  jokerLimit,
  jokerLocked,
  leagueId,
  matchId,
  matchName,
  onAdvanceRequested,
  onDeleted,
  onDraftStateChange,
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
  const [message, setMessage] = useState<string | undefined>();
  const [error, setErrorMessage] = useState<string | undefined>();
  const {
    formState: { errors, isDirty },
    getValues,
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
  const homeFilled = isFilledScore(homePrediction);
  const awayFilled = isFilledScore(awayPrediction);
  const pointsPreview = getPointsPreview(scoring, Boolean(joker));
  const selectingDifferentJoker = Boolean(roundJokerMatchId && roundJokerMatchId !== matchId);
  const jokerDisabled = jokerLimit < 1 || (jokerLocked && selectingDifferentJoker);

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  useEffect(() => {
    onDraftStateChange(matchId, {
      awayFilled,
      homeFilled,
      incomplete: isDirty && homeFilled !== awayFilled,
      isDirty
    });
  }, [awayFilled, homeFilled, isDirty, matchId, onDraftStateChange]);

  useEffect(() => {
    const homeScore = Number(homePrediction);
    const awayScore = Number(awayPrediction);

    if (Number.isFinite(homeScore) && Number.isFinite(awayScore)) {
      const nextPrediction = getPredictionFromScore(homeScore, awayScore);

      if (nextPrediction !== prediction) {
        setValue("prediction", nextPrediction, {
          shouldDirty: true,
          shouldValidate: true
        });
      }
    }
  }, [awayPrediction, homePrediction, prediction, setValue]);

  const onSubmit = useCallback(
    (values: UpsertGuessInput) => {
      setMessage(undefined);
      setErrorMessage(undefined);

      startTransition(async () => {
        const result = await upsertGuessAction(values);

        if (!result.ok) {
          setErrorMessage(result.message);
          applyServerFieldErrors(setError, result.fieldErrors);
          return;
        }

        const savedGuess = result.data?.guess;
        const preview = result.data?.pointsPreview ?? pointsPreview;

        if (savedGuess) {
          onSaved(matchId, savedGuess);
          reset(getDefaultValues(savedGuess, matchId, leagueId));
        }

        setMessage(`${result.message} Previa maxima: ${preview} pontos.`);
        onAdvanceRequested(matchId);
      });
    },
    [leagueId, matchId, onAdvanceRequested, onSaved, pointsPreview, reset, setError]
  );

  function selectPrediction(nextPrediction: GuessPrediction) {
    const currentHome = Number(getValues("homePrediction"));
    const currentAway = Number(getValues("awayPrediction"));
    const safeHome = Number.isFinite(currentHome) ? Math.max(0, Math.min(99, currentHome)) : 0;
    const safeAway = Number.isFinite(currentAway) ? Math.max(0, Math.min(99, currentAway)) : 0;

    if (nextPrediction === "HOME" && safeHome <= safeAway) {
      const awayScore = Math.min(safeAway, 98);
      setValue("awayPrediction", awayScore, { shouldDirty: true, shouldValidate: true });
      setValue("homePrediction", awayScore + 1, { shouldDirty: true, shouldValidate: true });
    }

    if (nextPrediction === "DRAW") {
      setValue("homePrediction", safeHome, { shouldDirty: true, shouldValidate: true });
      setValue("awayPrediction", safeHome, { shouldDirty: true, shouldValidate: true });
    }

    if (nextPrediction === "AWAY" && safeAway <= safeHome) {
      const homeScore = Math.min(safeHome, 98);
      setValue("homePrediction", homeScore, { shouldDirty: true, shouldValidate: true });
      setValue("awayPrediction", homeScore + 1, { shouldDirty: true, shouldValidate: true });
    }

    setValue("prediction", nextPrediction, {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  function confirmJoker() {
    setJokerDialogOpen(false);
    setMessage(undefined);
    setErrorMessage(undefined);

    if (!homeFilled || !awayFilled) {
      setErrorMessage("Complete o placar antes de confirmar o Coringa.");
      return;
    }

    const homeScore = Number(getValues("homePrediction"));
    const awayScore = Number(getValues("awayPrediction"));
    setValue("joker", true, { shouldDirty: true, shouldValidate: true });
    setValue("prediction", getPredictionFromScore(homeScore, awayScore), {
      shouldDirty: true,
      shouldValidate: true
    });

    window.setTimeout(() => {
      void handleSubmit(onSubmit)();
    }, 0);
  }

  function toggleJoker() {
    if (joker) {
      setValue("joker", false, { shouldDirty: true, shouldValidate: true });
      setMessage("Coringa removido deste palpite. Salve para confirmar a alteracao.");
      return;
    }

    setJokerDialogOpen(true);
  }

  function onDelete() {
    if (!existingGuess) return;

    setMessage(undefined);
    setErrorMessage(undefined);

    startDeleteTransition(async () => {
      const result = await deleteGuessAction({ guessId: existingGuess.id });

      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      reset(getDefaultValues(null, matchId, leagueId));
      onDeleted(matchId);
      setMessage(result.message);
    });
  }

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <input type="hidden" {...register("matchId")} />
        <input type="hidden" {...register("leagueId")} />
        <input type="hidden" {...register("joker")} />

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
          <label className="min-w-0 space-y-2">
            <span className="block truncate text-xs font-semibold uppercase text-app-muted">
              {existingGuess ? "Mandante" : "Placar mandante"}
            </span>
            <input
              aria-label={`Gols de ${matchName.split(" x ")[0]}`}
              className={cn(
                "h-14 w-full rounded-control border border-app-border bg-app-background text-center text-2xl font-bold text-app-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20",
                errors.homePrediction
                  ? "border-brand-red focus:border-brand-red focus:ring-brand-red/20"
                  : ""
              )}
              data-score-input
              inputMode="numeric"
              max={99}
              min={0}
              placeholder="-"
              type="number"
              {...register("homePrediction", { valueAsNumber: true })}
            />
          </label>
          <span className="pb-4 text-lg font-bold text-app-muted">x</span>
          <label className="min-w-0 space-y-2">
            <span className="block truncate text-xs font-semibold uppercase text-app-muted">
              {existingGuess ? "Visitante" : "Placar visitante"}
            </span>
            <input
              aria-label={`Gols de ${matchName.split(" x ")[1]}`}
              className={cn(
                "h-14 w-full rounded-control border border-app-border bg-app-background text-center text-2xl font-bold text-app-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20",
                errors.awayPrediction
                  ? "border-brand-red focus:border-brand-red focus:ring-brand-red/20"
                  : ""
              )}
              data-score-input
              inputMode="numeric"
              max={99}
              min={0}
              placeholder="-"
              type="number"
              {...register("awayPrediction", { valueAsNumber: true })}
            />
          </label>
        </div>

        {errors.homePrediction?.message || errors.awayPrediction?.message ? (
          <p className="text-sm text-red-600 dark:text-red-300">
            {errors.homePrediction?.message ?? errors.awayPrediction?.message}
          </p>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium text-app-foreground">Quem vence?</p>
          <div className="grid grid-cols-3 rounded-control border border-app-border bg-app-background p-1">
            {predictionOptions.map((option) => (
              <button
                aria-pressed={prediction === option.value}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center rounded-control px-2 text-xs font-semibold transition",
                  prediction === option.value && homeFilled && awayFilled
                    ? "bg-brand-gold text-slate-950 shadow-soft"
                    : "text-app-muted hover:bg-app-elevated hover:text-app-foreground"
                )}
                key={option.value}
                onClick={() => selectPrediction(option.value)}
                type="button"
              >
                <span className="text-lg leading-5">{option.label}</span>
                <span className="mt-1 text-[10px] uppercase leading-none">{option.helper}</span>
              </button>
            ))}
          </div>
          {errors.prediction?.message ? (
            <p className="text-sm text-red-600 dark:text-red-300">{errors.prediction.message}</p>
          ) : null}
        </div>

        <button
          aria-pressed={Boolean(joker)}
          className={cn(
            "flex w-full items-start gap-3 rounded-control border p-3 text-left transition",
            joker
              ? "border-brand-gold bg-brand-gold/10"
              : "border-app-border bg-app-background hover:border-brand-gold/60",
            jokerDisabled ? "cursor-not-allowed opacity-60" : ""
          )}
          disabled={jokerDisabled}
          onClick={toggleJoker}
          type="button"
        >
          <Star
            aria-hidden
            className={cn("mt-0.5 h-5 w-5 shrink-0", joker ? "fill-brand-gold text-brand-gold" : "text-brand-gold")}
          />
          <span className="min-w-0 text-sm">
            <span className="block font-semibold text-app-foreground">
              {joker ? "Coringa selecionado" : "Usar Coringa nesta partida"}
            </span>
            <span className="mt-1 block text-xs leading-5 text-app-muted">
              {jokerDisabled
                ? "O Coringa atual ja esta bloqueado."
                : `A pontuacao deste jogo sera multiplicada por ${scoring.jokerMultiplier}. Previa maxima: ${pointsPreview} pontos.`}
            </span>
          </span>
        </button>
        {errors.joker?.message ? (
          <p className="text-sm text-red-600 dark:text-red-300">{errors.joker.message}</p>
        ) : null}

        <ActionAlert message={message} tone="success" />
        <ActionAlert message={error} />

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <LoadingButton
            className="h-11 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:pointer-events-none"
            disabled={isDeleting}
            icon={<Save aria-hidden className="h-4 w-4" />}
            isLoading={isPending}
            loadingLabel="Salvando..."
            type="submit"
          >
            {existingGuess ? "Salvar alteracoes" : "Salvar palpite"}
          </LoadingButton>
          {existingGuess ? (
            <LoadingButton
              className="h-11 rounded-button border border-app-border bg-app-surface px-4 text-sm font-semibold text-app-foreground hover:border-brand-blue hover:text-brand-blue disabled:pointer-events-none"
              disabled={isPending}
              icon={<Trash2 aria-hidden className="h-4 w-4" />}
              isLoading={isDeleting}
              loadingLabel="Excluindo..."
              onClick={onDelete}
              type="button"
            >
              Excluir palpite
            </LoadingButton>
          ) : null}
        </div>
      </form>

      <GuessDialog
        footer={
          <>
            <button
              className="h-11 rounded-button border border-app-border px-4 text-sm font-semibold text-app-foreground hover:border-brand-blue"
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
            O Coringa esta em <strong className="text-app-foreground">{roundJokerMatchName}</strong>.
            Deseja transferi-lo para <strong className="text-app-foreground">{matchName}</strong>?
          </p>
        ) : (
          <p>
            Voce possui apenas um Coringa nesta rodada. Ao confirmar, a pontuacao obtida em
            <strong className="text-app-foreground"> {matchName}</strong> sera multiplicada por {" "}
            {scoring.jokerMultiplier}.
          </p>
        )}
      </GuessDialog>
    </>
  );
}
