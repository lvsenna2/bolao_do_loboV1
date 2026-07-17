import { Activity, AlertTriangle, CheckCircle2, Clock3, Radio, Server } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminAlert } from "@/features/admin/components/admin-alert";
import { ManualFootballSyncForm } from "@/features/admin/components/manual-football-sync-form";
import { getAdminFootballSyncStatus } from "@/features/admin/data/admin-data";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function formatDate(date: Date | null | undefined) {
  return date ? formatDateTimeInSaoPaulo(date) : "Nunca";
}

function StatusPill({ status }: { status?: string | null }) {
  const value = status || "IDLE";
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
      {value}
    </span>
  );
}

export default async function AdminFootballSyncPage() {
  const result = await getAdminFootballSyncStatus();
  const { apiConfigured, automation, competitions, manual, recentRuns, usage } = result.data;

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
          API configurada. A sincronizacao pode ser iniciada manualmente abaixo; o cron e opcional.
        </div>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase text-app-muted">Sincronizacao</p>
              <div className="mt-2">
                <StatusPill status={automation?.status} />
              </div>
            </div>
            <Server aria-hidden className="h-7 w-7 text-brand-gold" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase text-app-muted">Jogos acompanhados</p>
              <p className="mt-1 text-2xl font-bold text-app-foreground">
                {automation?.trackedMatches ?? 0}
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
            <StatusPill status={automation?.status} />
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
              <p className="text-app-muted">Finais incompletos</p>
              <p className="font-semibold">{automation?.pendingFinalDetails ?? 0}</p>
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
              disabled={!apiConfigured || automation?.status === "RUNNING"}
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
          <CardDescription>Da mais recente para a mais antiga.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-app-muted">Nenhuma sincronizacao foi executada.</p>
          ) : (
            <div className="space-y-3">
              {recentRuns.map((run) => (
                <div
                  className="flex flex-col gap-2 rounded-control border border-app-border bg-app-background p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  key={run.id}
                >
                  <div>
                    <p className="font-semibold text-app-foreground">
                      {run.message || "Sincronizacao API-Football"}
                    </p>
                    <p className="text-xs text-app-muted">
                      {formatDate(run.finishedAt || run.startedAt)} | {run.trigger}
                    </p>
                    {run.error ? <p className="mt-1 text-xs text-red-300">{run.error}</p> : null}
                  </div>
                  <StatusPill status={run.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
