"use client";

import { CheckCircle2, Database, Radio, RefreshCw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useRef, useState } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import {
  runManualFootballSyncAction,
  syncFootballMatchDetailsAction,
  type ManualFootballSyncProgress,
  updateCompetitionScoresAction
} from "@/features/admin/actions/admin-actions";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";
import type { FootballCompetitionKey } from "@/server/football-api/competitions";

type CompetitionOption = {
  key: FootballCompetitionKey;
  name: string;
  season: number;
};

type DetailMatchOption = {
  apiId: number;
  awayTeamName: string;
  competitionKey: FootballCompetitionKey;
  detailStatus: string;
  homeTeamName: string;
  id: string;
  kickoff: string;
  roundLabel: string;
  status: string;
};

type ManualFootballSyncFormProps = {
  competitions: CompetitionOption[];
  detailMatches: DetailMatchOption[];
  disabled: boolean;
};

export function ManualFootballSyncForm({
  competitions,
  detailMatches,
  disabled
}: ManualFootballSyncFormProps) {
  const router = useRouter();
  const lockRef = useRef(false);
  const initialCompetition = competitions[0]?.key ?? "brasileirao-serie-a";
  const [competitionKey, setCompetitionKey] = useState<FootballCompetitionKey>(initialCompetition);
  const [selectedMatchId, setSelectedMatchId] = useState(
    detailMatches.find((match) => match.competitionKey === initialCompetition)?.id ?? ""
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isSyncingDetails, setIsSyncingDetails] = useState(false);
  const [isUpdatingScores, setIsUpdatingScores] = useState(false);
  const [progress, setProgress] = useState<ManualFootballSyncProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const matchesForCompetition = useMemo(
    () => detailMatches.filter((match) => match.competitionKey === competitionKey),
    [competitionKey, detailMatches]
  );
  const isBusy = isRunning || isSyncingDetails || isUpdatingScores;

  function changeCompetition(key: FootballCompetitionKey) {
    setCompetitionKey(key);
    setSelectedMatchId(detailMatches.find((match) => match.competitionKey === key)?.id ?? "");
    setProgress(null);
    setMessage(null);
    setError(null);
  }

  async function handleCatalogSync(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || isBusy || lockRef.current) return;

    lockRef.current = true;
    setIsRunning(true);
    setProgress(null);
    setMessage(null);
    setError(null);

    try {
      const result = await runManualFootballSyncAction({
        competitionKey,
        includeCatalog: true
      });

      if (!result.ok || !result.data) {
        setError(result.message);
        return;
      }

      setProgress(result.data);
      setMessage(result.message);
    } catch {
      setError(
        "A atualizacao do catalogo foi interrompida. Os dados ja salvos foram mantidos; tente novamente."
      );
    } finally {
      lockRef.current = false;
      setIsRunning(false);
      router.refresh();
    }
  }

  async function handleMatchDetails() {
    if (disabled || isBusy || lockRef.current || !selectedMatchId) return;

    lockRef.current = true;
    setIsSyncingDetails(true);
    setProgress(null);
    setMessage(null);
    setError(null);

    try {
      const result = await syncFootballMatchDetailsAction({ matchId: selectedMatchId });

      if (!result.ok || !result.data) {
        setError(result.message);
        return;
      }

      setProgress(result.data);
      setMessage(result.message);
    } catch {
      setError(
        "Os detalhes da partida foram interrompidos. O progresso salvo foi mantido; tente novamente."
      );
    } finally {
      lockRef.current = false;
      setIsSyncingDetails(false);
      router.refresh();
    }
  }

  async function handleScoreUpdate() {
    if (disabled || isBusy || lockRef.current) return;

    lockRef.current = true;
    setIsUpdatingScores(true);
    setProgress(null);
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
    <div className="space-y-5">
      <form
        className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end"
        onSubmit={handleCatalogSync}
      >
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-app-foreground">
            Campeonato para sincronizar
          </span>
          <select
            className="h-11 w-full rounded-control border border-app-border bg-app-background px-3 text-sm font-semibold text-app-foreground outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
            disabled={disabled || isBusy}
            onChange={(event) => changeCompetition(event.target.value as FootballCompetitionKey)}
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
          disabled={disabled || isSyncingDetails || isUpdatingScores || competitions.length === 0}
          icon={<RefreshCw aria-hidden className="h-4 w-4" />}
          isLoading={isRunning}
          loadingLabel="Atualizando catalogo..."
          type="submit"
        >
          Atualizar catalogo
        </LoadingButton>

        <LoadingButton
          className="h-11 rounded-button border border-brand-gold bg-brand-gold/10 px-5 text-sm font-bold text-brand-gold hover:bg-brand-gold hover:text-slate-950"
          disabled={disabled || isRunning || isSyncingDetails || competitions.length === 0}
          icon={<Radio aria-hidden className="h-4 w-4" />}
          isLoading={isUpdatingScores}
          loadingLabel="Atualizando placares..."
          onClick={handleScoreUpdate}
          type="button"
        >
          Atualizar placares agora
        </LoadingButton>
      </form>

      <div className="grid gap-3 border-t border-app-border pt-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <label className="space-y-2">
          <span className="block text-sm font-semibold text-app-foreground">
            Partida para sincronizar detalhes
          </span>
          <select
            className="h-11 w-full rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
            disabled={disabled || isBusy || matchesForCompetition.length === 0}
            onChange={(event) => setSelectedMatchId(event.target.value)}
            value={selectedMatchId}
          >
            {matchesForCompetition.length === 0 ? (
              <option value="">Nenhuma partida proxima encontrada</option>
            ) : null}
            {matchesForCompetition.map((match) => (
              <option key={match.id} value={match.id}>
                {match.homeTeamName} x {match.awayTeamName} | {match.roundLabel} |{" "}
                {formatDateTimeInSaoPaulo(match.kickoff)} | {match.detailStatus}
              </option>
            ))}
          </select>
        </label>

        <LoadingButton
          className="h-11 rounded-button bg-brand-gold px-5 text-sm font-semibold text-slate-950 hover:bg-amber-300"
          disabled={disabled || isRunning || isUpdatingScores || !selectedMatchId}
          icon={<Database aria-hidden className="h-4 w-4" />}
          isLoading={isSyncingDetails}
          loadingLabel="Sincronizando partida..."
          onClick={handleMatchDetails}
          type="button"
        >
          Sincronizar esta partida
        </LoadingButton>
      </div>

      <p className="text-xs leading-5 text-app-muted">
        Cada execucao detalhada processa somente a partida selecionada. Historico e estadio podem
        ser atualizados imediatamente; escalacoes, eventos e estatisticas dependem da cobertura e do
        momento da partida.
      </p>

      {progress ? (
        <div
          className="rounded-control border border-app-border bg-app-background p-4"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-app-foreground">
            <Database aria-hidden className="h-4 w-4 text-brand-gold" />
            Ultimo processamento
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-app-muted sm:grid-cols-4">
            <span>{progress.trackedMatches} jogo(s) localizado(s)</span>
            <span>{progress.fixturesProcessed} partida(s) processada(s)</span>
            <span>{progress.fixturesUpdated} registro(s) atualizado(s)</span>
            <span>{progress.callsUsed} chamada(s) externa(s)</span>
          </div>
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
