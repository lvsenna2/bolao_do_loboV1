import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  Radio,
  Server
} from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminAlert } from "@/features/admin/components/admin-alert";
import { ManualFootballSyncForm } from "@/features/admin/components/manual-football-sync-form";
import { getAdminFootballSyncStatus } from "@/features/admin/data/admin-data";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";
import { withShortCache } from "@/server/cache/short-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const getCachedAdminFootballSyncStatus = withShortCache(
  "admin-football-sync-page-data",
  getAdminFootballSyncStatus
);

function formatDate(date: Date | null | undefined) {
  return date ? formatDateTimeInSaoPaulo(date) : "Nunca";
}

function StatusPill({ status }: { status?: string | null }) {
  const value = status || "IDLE";
  const label =
    value === "SUCCESS"
      ? "Concluida"
      : value === "RUNNING"
        ? "Em andamento"
        : value === "IDLE"
          ? "Em espera"
          : "Falhou";
  const classes =
    value === "SUCCESS"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : value === "RUNNING"
        ? "border-brand-gold/30 bg-brand-gold/10 text-brand-gold"
        : value === "IDLE"
          ? "border-app-border bg-app-background text-app-muted"
          : "border-red-500/30 bg-red-500/10 text-red-200";

  return (
    <span
      className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}

const apiCapabilities = [
  {
    endpoint: "fixtures",
    label: "Partidas e placares",
    purpose: "Status, minuto, placar e jogos recentes"
  },
  { endpoint: "fixtures/lineups", label: "Escalacoes", purpose: "Titulares e reservas" },
  { endpoint: "fixtures/events", label: "Eventos", purpose: "Gols, cartoes, VAR e substituicoes" },
  {
    endpoint: "fixtures/statistics",
    label: "Estatisticas",
    purpose: "Finalizacoes, posse e escanteios"
  },
  { endpoint: "fixtures/players", label: "Jogadores", purpose: "Desempenho individual" },
  {
    endpoint: "fixtures/headtohead",
    label: "Confrontos diretos",
    purpose: "Ultimos duelos dos times"
  },
  {
    endpoint: "teams/statistics",
    label: "Historico dos times",
    purpose: "Desempenho na temporada"
  },
  { endpoint: "standings", label: "Classificacao", purpose: "Tabela da competicao" },
  { endpoint: "venues", label: "Estadios", purpose: "Local e cidade da partida" }
] as const;

function formatDuration(durationMs: number) {
  if (durationMs < 1_000) return `${durationMs} ms`;
  if (durationMs < 60_000) return `${(durationMs / 1_000).toFixed(1)} s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);
  return `${minutes} min ${seconds} s`;
}

function triggerLabel(trigger: string) {
  if (trigger === "vercel-cron") return "Cron de placares";
  if (trigger === "vercel-catalog") return "Cron de catalogo";
  if (trigger === "admin-manual") return "Acao administrativa";
  if (trigger === "special-round-manual") return "Rodada especial";
  return trigger;
}

export default async function AdminFootballSyncPage() {
  const result = await getCachedAdminFootballSyncStatus();
  const {
    apiConfigured,
    automation,
    automationRunning,
    competitions,
    manual,
    recentRuns,
    requestReport,
    usage
  } = result.data;
  const displayStatus = automationRunning
    ? "RUNNING"
    : automation?.status === "FAILED"
      ? "FAILED"
      : automation?.lastSuccessAt
        ? "SUCCESS"
        : "IDLE";

  return (
    <PageShell
      description="Atualize campeonatos, partidas, placares e detalhes esportivos diretamente pelo painel."
      eyebrow="Administracao"
      title="Sincronizacao API-Football"
    >
      <AdminAlert message={result.ok ? undefined : result.message} />

      {!apiConfigured ? (
        <div className="mb-5 flex items-start gap-3 rounded-control border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
          <p>API_FOOTBALL_KEY nao esta configurada no servidor.</p>
        </div>
      ) : (
        <div className="mb-5 flex items-center gap-2 rounded-control border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <CheckCircle2 aria-hidden className="h-5 w-5" />
          API configurada. O Cron da Vercel acompanha placares automaticamente; os botoes abaixo
          ficam disponiveis como contingencia administrativa.
        </div>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase text-app-muted">Sincronizacao</p>
              <div className="mt-2">
                <StatusPill status={displayStatus} />
                <p className="mt-2 text-xs text-app-muted">
                  {automationRunning
                    ? `Iniciada ${formatDate(automation?.lastStartedAt)}`
                    : `Ultimo sucesso ${formatDate(automation?.lastSuccessAt)}`}
                </p>
              </div>
            </div>
            <Server aria-hidden className="h-7 w-7 text-brand-gold" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase text-app-muted">Janela analisada</p>
              <p className="mt-1 text-2xl font-bold text-app-foreground">
                {automation?.trackedMatches ?? 0}
                {(automation?.trackedMatches ?? 0) >= 100 ? "+" : ""}
              </p>
            </div>
            <Activity aria-hidden className="h-7 w-7 text-brand-gold" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase text-app-muted">Ao vivo</p>
              <p className="mt-1 text-2xl font-bold text-app-foreground">
                {automation?.liveMatches ?? 0}
              </p>
            </div>
            <Radio aria-hidden className="h-7 w-7 text-red-400" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase text-app-muted">Chamadas hoje</p>
              <p className="mt-1 text-2xl font-bold text-app-foreground">
                {usage.callsToday}
                {usage.dailyLimit ? (
                  <span className="text-sm text-app-muted"> / {usage.dailyLimit}</span>
                ) : null}
              </p>
            </div>
            <Clock3 aria-hidden className="h-7 w-7 text-brand-gold" />
          </CardContent>
        </Card>
      </div>

      <Card className="mb-5">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Atualizacao manual</CardTitle>
              <CardDescription>
                Atualize o catalogo a cada {manual.cooldownHours} horas, os placares quando
                necessario e os dados avancados individualmente por partida.
              </CardDescription>
            </div>
            <StatusPill status={manual.lastRun?.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-app-muted">Ultima execucao manual</p>
              <p className="font-semibold">{formatDate(manual.lastRun?.finishedAt)}</p>
            </div>
            <div>
              <p className="text-app-muted">Processamento</p>
              <p className="font-semibold">Lotes automaticos por campeonato</p>
            </div>
            <div>
              <p className="text-app-muted">Escalacoes pendentes</p>
              <p className="font-semibold">{automation?.pendingLineups ?? 0}</p>
            </div>
            <div>
              <p className="text-app-muted">Finais incompletos na amostra</p>
              <p className="font-semibold">
                {automation?.pendingFinalDetails ?? 0}
                {(automation?.pendingFinalDetails ?? 0) >= 100 &&
                automation?.pendingFinalDetails === automation?.trackedMatches
                  ? "+"
                  : ""}
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-app-border pt-5">
            <ManualFootballSyncForm
              competitions={competitions.map((competition) => ({
                key: competition.key,
                name: competition.name,
                season: competition.season
              }))}
              detailMatches={result.data.detailMatches}
              disabled={!apiConfigured || automationRunning}
            />
            <p className="mt-2 max-w-2xl text-xs text-app-muted">
              O catalogo atualiza times, rodadas, partidas e tabela sem alterar a abertura manual
              das rodadas da liga. O botao de placares consulta jogos ao vivo, recentes ou ainda nao
              homologados.
            </p>
          </div>

          {automation?.lastError ? (
            <p className="mt-4 text-sm text-red-300">Ultimo erro: {automation.lastError}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Relatorio de consumo da API</CardTitle>
              <CardDescription>
                Chamadas registradas desde {formatDate(requestReport.windowStartedAt)}. Os usuarios
                recebem os dados do banco; estas consultas sao executadas apenas pelo servidor.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 rounded-control border border-app-border bg-app-background px-3 py-2 text-sm">
              <Gauge aria-hidden className="h-4 w-4 text-brand-gold" />
              <strong>{usage.callsToday}</strong>
              <span className="text-app-muted">chamadas hoje</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {requestReport.sampleSize > 0 ? (
            <div className="mb-4 rounded-control border border-brand-gold/25 bg-brand-gold/5 px-4 py-3 text-sm text-app-muted">
              Na amostra das ultimas {requestReport.sampleSize} chamadas, foram encontradas{" "}
              <strong className="text-app-foreground">
                {requestReport.repeatedCallsInSample} repeticoes dos mesmos parametros
              </strong>
              . Repeticoes podem ser validas em jogos ao vivo; historico e classificacao agora sao
              limitados a lotes de 30 minutos.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {apiCapabilities.map((capability) => {
              const stats = requestReport.endpoints.find(
                (endpoint) => endpoint.endpoint === capability.endpoint
              );
              return (
                <div
                  className="min-w-0 rounded-control border border-app-border bg-app-background p-4"
                  key={capability.endpoint}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-app-foreground">{capability.label}</p>
                      <p className="mt-1 text-xs text-app-muted">{capability.purpose}</p>
                    </div>
                    <Database aria-hidden className="h-5 w-5 shrink-0 text-brand-gold" />
                  </div>
                  <code className="mt-3 block truncate text-xs text-brand-gold">
                    /{capability.endpoint}
                  </code>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="block text-app-muted">Chamadas</span>
                      <strong className="text-app-foreground">{stats?.calls ?? 0}</strong>
                    </div>
                    <div>
                      <span className="block text-app-muted">Falhas</span>
                      <strong className={stats?.failures ? "text-red-300" : "text-emerald-300"}>
                        {stats?.failures ?? 0}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-app-muted">Tempo medio</span>
                      <strong className="text-app-foreground">
                        {formatDuration(stats?.averageDurationMs ?? 0)}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-app-muted">Consultas distintas</span>
                      <strong className="text-app-foreground">
                        {stats?.uniqueQueriesInSample ?? 0}
                      </strong>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-app-muted">
                    Ultima chamada: {formatDate(stats?.lastCalledAt)}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        {competitions.map((competition) => (
          <Card key={competition.key}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{competition.name}</CardTitle>
                  <CardDescription>
                    ID {competition.leagueId} | {competition.season} | {competition.type}
                  </CardDescription>
                </div>
                <StatusPill status={competition.lastAttempt?.status} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-control border border-app-border bg-app-background p-3">
                  <strong className="block text-app-foreground">{competition.local.rounds}</strong>
                  <span className="text-app-muted">Rodadas</span>
                </div>
                <div className="rounded-control border border-app-border bg-app-background p-3">
                  <strong className="block text-app-foreground">{competition.local.matches}</strong>
                  <span className="text-app-muted">Partidas</span>
                </div>
                <div className="rounded-control border border-app-border bg-app-background p-3">
                  <strong className="block text-app-foreground">
                    {competition.local.standings}
                  </strong>
                  <span className="text-app-muted">Tabela</span>
                </div>
              </div>
              <p className="mt-4 text-sm text-app-muted">
                Ultima importacao de catalogo: {formatDate(competition.lastSuccess?.finishedAt)}
              </p>
              {competition.lastAttempt?.message ? (
                <p className="mt-1 text-xs text-app-muted">{competition.lastAttempt.message}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ultimas execucoes</CardTitle>
          <CardDescription>
            Cada linha mostra o trabalho real da execucao e quais endpoints consumiram chamadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-app-muted">Nenhuma sincronizacao foi executada.</p>
          ) : (
            <div className="space-y-3">
              {recentRuns.map((run) => (
                <div
                  className="rounded-control border border-app-border bg-app-background p-4 text-sm"
                  key={run.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-app-foreground">
                        {triggerLabel(run.trigger)}
                      </p>
                      <p className="mt-1 text-xs text-app-muted">
                        {formatDate(run.finishedAt || run.startedAt)} | Duracao{" "}
                        {formatDuration(run.durationMs)}
                      </p>
                    </div>
                    <StatusPill status={run.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-app-border px-2.5 py-1">
                      {run.callsUsed} chamada(s)
                    </span>
                    <span className="rounded-full border border-app-border px-2.5 py-1">
                      {run.trackedMatches} na janela
                    </span>
                    <span className="rounded-full border border-app-border px-2.5 py-1">
                      {run.liveMatches} ao vivo
                    </span>
                    <span className="rounded-full border border-app-border px-2.5 py-1">
                      {run.pendingLineups} escalacao(oes) pendente(s)
                    </span>
                  </div>
                  {run.requestBreakdown.length > 0 ? (
                    <p className="mt-3 text-xs text-app-muted">
                      API:{" "}
                      {run.requestBreakdown
                        .map((item) => `${item.endpoint} (${item.calls})`)
                        .join(" | ")}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-app-muted">
                      Nenhuma chamada externa registrada.
                    </p>
                  )}
                  {run.message ? (
                    <details className="mt-3 text-xs text-app-muted">
                      <summary className="cursor-pointer font-medium text-app-foreground">
                        Ver resumo tecnico
                      </summary>
                      <p className="mt-2 leading-5">{run.message}</p>
                    </details>
                  ) : null}
                  {run.error ? <p className="mt-2 text-xs text-red-300">{run.error}</p> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
