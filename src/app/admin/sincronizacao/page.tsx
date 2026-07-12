import { AlertTriangle, CheckCircle2, Database, RefreshCw } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  syncAllFootballCompetitionScoresAction,
  syncAllFootballCompetitionsAction,
  syncFootballCompetitionScoresAction,
  syncFootballCompetitionAction
} from "@/features/admin/actions/admin-actions";
import { AdminAlert } from "@/features/admin/components/admin-alert";
import { AdminSubmitButton } from "@/features/admin/components/admin-submit-button";
import { getAdminFootballSyncStatus } from "@/features/admin/data/admin-data";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;

const syncFootballCompetitionFormAction = syncFootballCompetitionAction as unknown as FormAction;
const syncFootballCompetitionScoresFormAction =
  syncFootballCompetitionScoresAction as unknown as FormAction;
const syncAllFootballCompetitionsFormAction =
  syncAllFootballCompetitionsAction as unknown as FormAction;
const syncAllFootballCompetitionScoresFormAction =
  syncAllFootballCompetitionScoresAction as unknown as FormAction;

function formatDate(date: Date | null | undefined) {
  if (!date) {
    return "Nunca";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function StatusPill({ status }: { status?: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex h-7 items-center rounded-full border border-app-border px-3 text-xs font-semibold text-app-muted">
        Sem sync
      </span>
    );
  }

  const classes =
    status === "SUCCESS"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
      : status === "SKIPPED"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200"
        : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";

  return (
    <span
      className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold ${classes}`}
    >
      {status}
    </span>
  );
}

export default async function AdminFootballSyncPage() {
  const result = await getAdminFootballSyncStatus();
  const { apiConfigured, cacheHours, competitions } = result.data;

  return (
    <PageShell
      description="Importe competicoes, times, escudos, jogos, fases e classificacoes para o banco local."
      eyebrow="Administracao"
      title="Sincronizacao API-Football"
    >
      <AdminAlert message={result.ok ? undefined : result.message} />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Sincronizar competicoes</CardTitle>
          <CardDescription>
            O app usa cache de {cacheHours} horas e o frontend le apenas o banco local.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={
              apiConfigured
                ? "mb-4 flex items-center gap-2 rounded-control border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200"
                : "mb-4 flex items-center gap-2 rounded-control border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200"
            }
          >
            {apiConfigured ? (
              <CheckCircle2 aria-hidden className="h-4 w-4" />
            ) : (
              <AlertTriangle aria-hidden className="h-4 w-4" />
            )}
            {apiConfigured
              ? "API_FOOTBALL_KEY configurada no servidor."
              : "Configure API_FOOTBALL_KEY no ambiente antes de sincronizar."}
          </div>

          <div className="flex flex-wrap gap-3">
            <form action={syncAllFootballCompetitionsFormAction}>
              <AdminSubmitButton
                className="inline-flex h-10 items-center gap-2 rounded-button bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!apiConfigured}
                pendingLabel="Sincronizando..."
              >
                <RefreshCw aria-hidden className="h-4 w-4" />
                Sincronizar todas
              </AdminSubmitButton>
            </form>
            <form action={syncAllFootballCompetitionScoresFormAction}>
              <AdminSubmitButton
                className="inline-flex h-10 items-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!apiConfigured}
                pendingLabel="Atualizando..."
              >
                <RefreshCw aria-hidden className="h-4 w-4" />
                Atualizar placares
              </AdminSubmitButton>
            </form>
            <form action={syncAllFootballCompetitionsFormAction}>
              <input name="force" type="hidden" value="true" />
              <AdminSubmitButton
                className="inline-flex h-10 items-center gap-2 rounded-button border border-app-border bg-app-surface px-4 text-sm font-semibold text-app-foreground transition hover:border-brand-gold hover:text-brand-gold disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!apiConfigured}
                pendingLabel="Sincronizando..."
              >
                Forcar todas
              </AdminSubmitButton>
            </form>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        {competitions.map((competition) => (
          <Card key={competition.key}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{competition.name}</CardTitle>
                  <CardDescription>
                    ID {competition.leagueId} | {competition.season} |{" "}
                    {competition.countryOrContinent} | {competition.type}
                  </CardDescription>
                </div>
                <StatusPill status={competition.lastAttempt?.status} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm text-app-muted sm:grid-cols-3">
                <div className="rounded-control border border-app-border bg-app-background p-3">
                  <p className="font-semibold text-app-foreground">{competition.local.rounds}</p>
                  <p>Fases/rodadas</p>
                </div>
                <div className="rounded-control border border-app-border bg-app-background p-3">
                  <p className="font-semibold text-app-foreground">{competition.local.matches}</p>
                  <p>Partidas</p>
                </div>
                <div className="rounded-control border border-app-border bg-app-background p-3">
                  <p className="font-semibold text-app-foreground">{competition.local.standings}</p>
                  <p>Classificacao</p>
                </div>
              </div>

              <div className="mt-4 space-y-1 text-sm text-app-muted">
                <p>Ultimo sucesso: {formatDate(competition.lastSuccess?.finishedAt)}</p>
                <p>Ultima tentativa: {formatDate(competition.lastAttempt?.finishedAt)}</p>
                <p>
                  Ultima atualizacao de placares:{" "}
                  {formatDate(competition.lastScoreSuccess?.finishedAt)}
                </p>
                {competition.lastAttempt?.message ? (
                  <p className="text-xs">{competition.lastAttempt.message}</p>
                ) : null}
                {competition.lastScoreAttempt?.message ? (
                  <p className="text-xs text-brand-gold">{competition.lastScoreAttempt.message}</p>
                ) : null}
                {competition.lastAttempt ? (
                  <p className="text-xs">
                    Chamadas usadas: {competition.lastAttempt.callsUsed} | Times:{" "}
                    {competition.lastAttempt.teamsImported} | Jogos:{" "}
                    {competition.lastAttempt.matchesImported}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <form action={syncFootballCompetitionFormAction}>
                  <input name="competitionKey" type="hidden" value={competition.key} />
                  <AdminSubmitButton
                    className="inline-flex h-10 items-center gap-2 rounded-button bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!apiConfigured}
                    pendingLabel="Sincronizando..."
                  >
                    <Database aria-hidden className="h-4 w-4" />
                    Sincronizar
                  </AdminSubmitButton>
                </form>
                <form action={syncFootballCompetitionScoresFormAction}>
                  <input name="competitionKey" type="hidden" value={competition.key} />
                  <AdminSubmitButton
                    className="inline-flex h-10 items-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!apiConfigured}
                    pendingLabel="Atualizando..."
                  >
                    <RefreshCw aria-hidden className="h-4 w-4" />
                    Atualizar placares
                  </AdminSubmitButton>
                </form>
                <form action={syncFootballCompetitionFormAction}>
                  <input name="competitionKey" type="hidden" value={competition.key} />
                  <input name="force" type="hidden" value="true" />
                  <AdminSubmitButton
                    className="h-10 rounded-button border border-app-border bg-app-surface px-4 text-sm font-semibold text-app-foreground transition hover:border-brand-gold hover:text-brand-gold disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!apiConfigured}
                    pendingLabel="Sincronizando..."
                  >
                    Forcar
                  </AdminSubmitButton>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
