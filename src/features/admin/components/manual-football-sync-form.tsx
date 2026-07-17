"use client";

import { CheckCircle2, Database, Radio, RefreshCw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import {
  runManualFootballSyncAction,
  type ManualFootballSyncProgress,
  updateCompetitionScoresAction
} from "@/features/admin/actions/admin-actions";
import type { FootballCompetitionKey } from "@/server/football-api/competitions";

type CompetitionOption = {
  key: FootballCompetitionKey;
  name: string;
  season: number;
};

type ManualFootballSyncFormProps = {
  competitions: CompetitionOption[];
  disabled: boolean;
};

const MAX_BATCHES_PER_RUN = 50;

export function ManualFootballSyncForm({
  competitions,
  disabled
}: ManualFootballSyncFormProps) {
  const router = useRouter();
  const lockRef = useRef(false);
  const [competitionKey, setCompetitionKey] = useState<FootballCompetitionKey>(
    competitions[0]?.key ?? "brasileirao-serie-a"
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isUpdatingScores, setIsUpdatingScores] = useState(false);
  const [batch, setBatch] = useState(0);
  const [initialWork, setInitialWork] = useState(0);
  const [progress, setProgress] = useState<ManualFootballSyncProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completed = progress
    ? Math.max(0, initialWork - progress.remainingCandidates)
    : 0;
  const percentage = progress?.complete
    ? 100
    : initialWork > 0
      ? Math.min(100, Math.round((completed / initialWork) * 100))
      : 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || isRunning || isUpdatingScores || lockRef.current) return;

    lockRef.current = true;
    setIsRunning(true);
    setBatch(0);
    setInitialWork(0);
    setProgress(null);
    setMessage(null);
    setError(null);

    let includeCatalog = true;
    let workTotal = 0;

    try {
      for (let currentBatch = 1; currentBatch <= MAX_BATCHES_PER_RUN; currentBatch += 1) {
        setBatch(currentBatch);
        const result = await runManualFootballSyncAction({
          competitionKey,
          includeCatalog
        });

        if (!result.ok || !result.data) {
          setError(result.message);
          return;
        }

        const current = result.data;
        workTotal = Math.max(
          workTotal,
          current.remainingCandidates + current.fixturesProcessed
        );
        setInitialWork(workTotal);
        setProgress(current);
        setMessage(result.message);
        includeCatalog = false;

        if (current.complete) {
          setMessage(`Sincronizacao completa. ${result.message}`);
          return;
        }
      }

      setMessage(
        "O limite seguro desta execucao foi atingido. Clique novamente para continuar os detalhes restantes."
      );
    } catch {
      setError(
        "A sincronizacao foi interrompida pela conexao ou pelo limite do servidor. O progresso salvo foi mantido; tente continuar novamente."
      );
    } finally {
      lockRef.current = false;
      setIsRunning(false);
      router.refresh();
    }
  }

  async function handleScoreUpdate() {
    if (disabled || isRunning || isUpdatingScores || lockRef.current) return;

    lockRef.current = true;
    setIsUpdatingScores(true);
    setMessage(null);
    setError(null);

    try {
      const result = await updateCompetitionScoresAction({ competitionKey });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
    } catch {
      setError(
        "A atualizacao de placares foi interrompida. Nenhuma pontuacao sera duplicada; tente novamente."
      );
    } finally {
      lockRef.current = false;
      setIsUpdatingScores(false);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end"
        onSubmit={handleSubmit}
      >
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-app-foreground">
            Campeonato para sincronizar
          </span>
          <select
            className="h-11 w-full rounded-control border border-app-border bg-app-background px-3 text-sm font-semibold text-app-foreground outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
            disabled={disabled || isRunning || isUpdatingScores}
            onChange={(event) => setCompetitionKey(event.target.value as FootballCompetitionKey)}
            value={competitionKey}
          >
            {competitions.map((competition) => (
              <option key={competition.key} value={competition.key}>
                {competition.name} - {competition.season}
              </option>
            ))}
          </select>
        </label>

        <LoadingButton
          className="h-11 rounded-button bg-brand-gold px-5 text-sm font-bold text-slate-950 shadow-soft hover:bg-amber-400"
          disabled={disabled || isUpdatingScores || competitions.length === 0}
          icon={<RefreshCw aria-hidden className="h-4 w-4" />}
          isLoading={isRunning}
          loadingLabel={batch > 0 ? `Processando lote ${batch}...` : "Preparando..."}
          type="submit"
        >
          Sincronizar campeonato
        </LoadingButton>

        <LoadingButton
          className="h-11 rounded-button border border-brand-blue bg-brand-blue/10 px-5 text-sm font-bold text-brand-blue hover:bg-brand-blue hover:text-white"
          disabled={disabled || isRunning || competitions.length === 0}
          icon={<Radio aria-hidden className="h-4 w-4" />}
          isLoading={isUpdatingScores}
          loadingLabel="Atualizando placares..."
          onClick={handleScoreUpdate}
          type="button"
        >
          Atualizar placares agora
        </LoadingButton>
      </form>

      {isRunning || progress ? (
        <div className="rounded-control border border-app-border bg-app-background p-4" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-semibold text-app-foreground">
              <Database aria-hidden className="h-4 w-4 text-brand-gold" />
              {isRunning ? `Lote ${batch} em andamento` : "Ultimo processamento"}
            </span>
            <span className="text-app-muted">
              {progress?.remainingCandidates ?? 0} partida(s) aguardando detalhes
            </span>
          </div>
          <div
            aria-label={`${percentage}% da sincronizacao detalhada concluida`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={percentage}
            className="mt-3 h-2 overflow-hidden rounded-full bg-app-surface"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-brand-gold transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${percentage}%` }}
            />
          </div>
          {progress ? (
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-app-muted sm:grid-cols-4">
              <span>{progress.trackedMatches} jogos encontrados</span>
              <span>{progress.fixturesProcessed} processados no lote</span>
              <span>{progress.fixturesUpdated} registros atualizados</span>
              <span>{progress.callsUsed} chamadas neste lote</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <div className="flex items-start gap-2 text-sm text-emerald-300" role="status">
          <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{message}</p>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 text-sm text-amber-200" role="alert">
          <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}
    </div>
  );
}
