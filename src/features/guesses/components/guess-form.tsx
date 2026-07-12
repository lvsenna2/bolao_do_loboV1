"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Trash2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { LoadingButton } from "@/components/ui/loading-button";
import { cn } from "@/lib/utils";
import { ActionAlert } from "@/features/auth/components/action-alert";
import { applyServerFieldErrors } from "@/features/auth/components/form-error-utils";
import { deleteGuessAction, upsertGuessAction } from "../actions/guess-actions";
import {
  getPredictionFromScore,
  upsertGuessSchema,
  type GuessPrediction,
  type UpsertGuessInput
} from "../schemas/guess-schemas";
import type { ScoringDefaults } from "../data/guess-data";

type ExistingGuess = {
  awayPrediction: number | null;
  homePrediction: number | null;
  id: string;
  joker: boolean;
  prediction: GuessPrediction;
} | null;

type GuessFormProps = {
  existingGuess: ExistingGuess;
  jokerAvailable: boolean;
  jokerLimit: number;
  leagueId?: string;
  matchId: string;
  scoring: ScoringDefaults;
  usedJokersInRound: number;
};

const predictionOptions = [
  { helper: "Mandante", label: "1", value: "HOME" },
  { helper: "Empate", label: "X", value: "DRAW" },
  { helper: "Visitante", label: "2", value: "AWAY" }
] satisfies Array<{ helper: string; label: string; value: GuessPrediction }>;

function getDefaultValues(
  existingGuess: ExistingGuess,
  matchId: string,
  leagueId?: string
): UpsertGuessInput {
  const homePrediction = existingGuess?.homePrediction ?? 0;
  const awayPrediction = existingGuess?.awayPrediction ?? 0;

  return {
    awayPrediction,
    homePrediction,
    joker: existingGuess?.joker ?? false,
    leagueId,
    matchId,
    prediction:
      existingGuess?.homePrediction !== null && existingGuess?.awayPrediction !== null
        ? getPredictionFromScore(homePrediction, awayPrediction)
        : (existingGuess?.prediction ?? "DRAW")
  };
}

function getPointsPreview(scoring: ScoringDefaults, joker: boolean) {
  const basePoints = scoring.winnerHit + scoring.exactScoreBonus;

  return joker ? basePoints * scoring.jokerMultiplier : basePoints;
}

export function GuessForm({
  existingGuess,
  jokerAvailable,
  jokerLimit,
  leagueId,
  matchId,
  scoring,
  usedJokersInRound
}: GuessFormProps) {
  const defaultValues = useMemo(
    () => getDefaultValues(existingGuess, matchId, leagueId),
    [existingGuess, leagueId, matchId]
  );
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [message, setMessage] = useState<string | undefined>();
  const [error, setErrorMessage] = useState<string | undefined>();
  const {
    formState: { errors },
    getValues,
    handleSubmit,
    register,
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
  const pointsPreview = getPointsPreview(scoring, Boolean(joker));
  const jokerDisabled = !jokerAvailable && !existingGuess?.joker;

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

  function onSubmit(values: UpsertGuessInput) {
    setMessage(undefined);
    setErrorMessage(undefined);

    startTransition(() => {
      void upsertGuessAction(values).then((result) => {
        if (!result.ok) {
          setErrorMessage(result.message);
          applyServerFieldErrors(setError, result.fieldErrors);
          return;
        }

        const preview = result.data?.pointsPreview ?? pointsPreview;
        setMessage(`${result.message} Previa maxima se acertar o placar: ${preview} pontos.`);
        router.refresh();
      });
    });
  }

  function onDelete() {
    if (!existingGuess) {
      return;
    }

    setMessage(undefined);
    setErrorMessage(undefined);

    startDeleteTransition(() => {
      void deleteGuessAction({ guessId: existingGuess.id }).then((result) => {
        if (!result.ok) {
          setErrorMessage(result.message);
          return;
        }

        setMessage(result.message);
        router.refresh();
      });
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register("matchId")} />
      <input type="hidden" {...register("leagueId")} />

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-app-muted">
            Mandante
          </span>
          <input
            className={cn(
              "h-12 w-full rounded-control border border-app-border bg-app-background text-center text-lg font-bold text-app-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20",
              errors.homePrediction
                ? "border-brand-red focus:border-brand-red focus:ring-brand-red/20"
                : ""
            )}
            max={99}
            min={0}
            type="number"
            {...register("homePrediction", { valueAsNumber: true })}
          />
        </label>
        <span className="pb-3 text-lg font-bold text-app-muted">x</span>
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-app-muted">
            Visitante
          </span>
          <input
            className={cn(
              "h-12 w-full rounded-control border border-app-border bg-app-background text-center text-lg font-bold text-app-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20",
              errors.awayPrediction
                ? "border-brand-red focus:border-brand-red focus:ring-brand-red/20"
                : ""
            )}
            max={99}
            min={0}
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
                prediction === option.value
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

      <label
        className={cn(
          "flex items-start gap-3 rounded-control border border-app-border bg-app-background p-3",
          jokerDisabled ? "opacity-60" : ""
        )}
      >
        <input
          className="mt-1 h-4 w-4 rounded border-app-border text-brand-gold focus:ring-brand-gold"
          disabled={jokerDisabled}
          type="checkbox"
          {...register("joker")}
        />
        <span className="min-w-0 text-sm">
          <span className="flex items-center gap-2 font-semibold text-app-foreground">
            <Wand2 aria-hidden className="h-4 w-4 text-brand-gold" />
            Usar curinga
          </span>
          <span className="mt-1 block text-xs leading-5 text-app-muted">
            {usedJokersInRound}/{jokerLimit} usado nesta rodada. Previa maxima: {pointsPreview}{" "}
            pontos.
          </span>
        </span>
      </label>
      {errors.joker?.message ? (
        <p className="text-sm text-red-600 dark:text-red-300">{errors.joker.message}</p>
      ) : null}

      <ActionAlert message={message} tone="success" />
      <ActionAlert message={error} />

      <div className="flex flex-wrap items-center gap-2">
        <LoadingButton
          className="inline-flex h-10 items-center justify-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:pointer-events-none disabled:opacity-60"
          disabled={isDeleting}
          icon={<Save aria-hidden className="h-4 w-4" />}
          isLoading={isPending}
          loadingLabel="Salvando..."
          type="submit"
        >
          {existingGuess ? "Atualizar palpite" : "Confirmar palpite"}
        </LoadingButton>
        {existingGuess ? (
          <LoadingButton
            className="inline-flex h-10 items-center justify-center gap-2 rounded-button border border-app-border bg-app-surface px-4 text-sm font-semibold text-app-foreground transition hover:border-brand-blue hover:text-brand-blue disabled:pointer-events-none disabled:opacity-60"
            disabled={isPending}
            icon={<Trash2 aria-hidden className="h-4 w-4" />}
            isLoading={isDeleting}
            loadingLabel="Excluindo..."
            onClick={onDelete}
            type="button"
          >
            Excluir
          </LoadingButton>
        ) : null}
      </div>
    </form>
  );
}
