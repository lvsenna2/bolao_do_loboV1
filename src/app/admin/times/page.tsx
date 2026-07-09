import { Database, PlugZap, UploadCloud } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  bulkImportTeamsAction,
  createTeamAction,
  importApiFootballTeamsAction,
  importTeamPresetAction
} from "@/features/admin/actions/admin-actions";
import { AdminAlert } from "@/features/admin/components/admin-alert";
import { AdminEmpty } from "@/features/admin/components/admin-empty";
import { AdminFilterForm } from "@/features/admin/components/admin-filter-form";
import { AdminPagination } from "@/features/admin/components/admin-pagination";
import {
  AdminTable,
  AdminTableBody,
  AdminTableHead,
  AdminTd,
  AdminTh
} from "@/features/admin/components/admin-table";
import { teamPresetOptions } from "@/features/admin/data/team-presets";
import { getAdminTeams } from "@/features/admin/data/admin-data";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;
type AdminTeamsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const bulkImportTeamsFormAction = bulkImportTeamsAction as unknown as FormAction;
const createTeamFormAction = createTeamAction as unknown as FormAction;
const importApiFootballTeamsFormAction = importApiFootballTeamsAction as unknown as FormAction;
const importTeamPresetFormAction = importTeamPresetAction as unknown as FormAction;

const inputClass =
  "h-10 rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition placeholder:text-app-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

const textareaClass =
  "min-h-36 rounded-control border border-app-border bg-app-background px-3 py-2 text-sm text-app-foreground outline-none transition placeholder:text-app-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
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

export default async function AdminTeamsPage({ searchParams }: AdminTeamsPageProps) {
  const params = await searchParams;
  const result = await getAdminTeams(params);
  const teams = result.data.items;

  return (
    <PageShell
      description="Cadastre times manualmente, em lote, por biblioteca pronta ou pela API de futebol."
      eyebrow="Administracao"
      title="Times"
    >
      <AdminAlert message={result.ok ? undefined : result.message} />

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Novo time</CardTitle>
            <CardDescription>Cadastro direto para um mandante ou visitante.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createTeamFormAction} className="grid gap-3 md:grid-cols-2">
              <input className={inputClass} name="name" placeholder="Nome do time" required />
              <input className={inputClass} name="shortName" placeholder="Sigla" />
              <input className={inputClass} name="country" placeholder="Pais" required />
              <input className={inputClass} name="logo" placeholder="URL do escudo" type="url" />
              <input className={inputClass} name="apiId" placeholder="ID na API" type="number" />
              <button
                className="h-10 rounded-button bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                type="submit"
              >
                Cadastrar time
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Importar em lote</CardTitle>
            <CardDescription>Use uma linha por time para acelerar cadastros grandes.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={bulkImportTeamsFormAction} className="grid gap-3">
              <textarea
                className={textareaClass}
                name="teams"
                placeholder={`Brasil;BRA;Brasil;https://flagcdn.com/w80/br.png\nArgentina;ARG;Argentina;https://flagcdn.com/w80/ar.png\nFlamengo;FLA;Brasil`}
                required
              />
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-button bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                type="submit"
              >
                <UploadCloud aria-hidden className="h-4 w-4" />
                Importar lote
              </button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Biblioteca pronta</CardTitle>
            <CardDescription>Carregue listas comuns sem pesquisar escudo manualmente.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={importTeamPresetFormAction} className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                {teamPresetOptions.map((preset) => (
                  <label
                    className="cursor-pointer rounded-card border border-app-border bg-app-background p-4 transition hover:border-brand-gold"
                    key={preset.id}
                  >
                    <input
                      className="sr-only"
                      defaultChecked={preset.id === "national-teams"}
                      name="preset"
                      type="radio"
                      value={preset.id}
                    />
                    <span className="flex items-start gap-3">
                      <Database aria-hidden className="mt-0.5 h-5 w-5 text-brand-gold" />
                      <span>
                        <span className="block font-semibold text-app-foreground">
                          {preset.label}
                        </span>
                        <span className="mt-1 block text-sm text-app-muted">
                          {preset.description}
                        </span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <button
                className="h-10 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
                type="submit"
              >
                Importar biblioteca
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API-Football</CardTitle>
            <CardDescription>Busca times oficiais e grava no banco local.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={
                result.data.apiConfigured
                  ? "mb-3 flex items-center gap-2 rounded-control border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200"
                  : "mb-3 flex items-center gap-2 rounded-control border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-200"
              }
            >
              <PlugZap aria-hidden className="h-4 w-4" />
              {result.data.apiConfigured
                ? "API configurada no ambiente."
                : "Configure API_FOOTBALL_KEY para liberar a importacao."}
            </div>
            <form action={importApiFootballTeamsFormAction} className="grid gap-3 md:grid-cols-3">
              <input className={inputClass} name="country" placeholder="Pais na API: Brazil" />
              <input
                className={inputClass}
                min="1"
                name="leagueId"
                placeholder="ID da liga"
                type="number"
              />
              <input
                className={inputClass}
                max="2200"
                min="1900"
                name="season"
                placeholder="Temporada"
                type="number"
              />
              <button
                className="h-10 rounded-button bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-3"
                disabled={!result.data.apiConfigured}
                type="submit"
              >
                Importar da API
              </button>
            </form>
          </CardContent>
        </Card>
      </div>

      <AdminFilterForm placeholder="Nome, sigla ou pais" query={String(params.q ?? "")} />

      {teams.length === 0 ? (
        <AdminEmpty
          description="Cadastre manualmente, importe em lote ou carregue uma biblioteca pronta."
          title="Nenhum time encontrado"
        />
      ) : (
        <>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTh>Time</AdminTh>
                <AdminTh>Pais</AdminTh>
                <AdminTh>API</AdminTh>
                <AdminTh>Uso</AdminTh>
                <AdminTh>Criado</AdminTh>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <AdminTd>
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-elevated bg-contain bg-center bg-no-repeat text-xs font-bold text-app-foreground"
                        style={team.logo ? { backgroundImage: `url("${team.logo}")` } : undefined}
                      >
                        {team.logo ? null : getInitials(team.name)}
                      </span>
                      <div>
                        <p className="font-semibold">{team.name}</p>
                        <p className="text-xs text-app-muted">{team.shortName || "Sem sigla"}</p>
                      </div>
                    </div>
                  </AdminTd>
                  <AdminTd>{team.country}</AdminTd>
                  <AdminTd>
                    <p>{team.apiId ? "API-Football" : "Manual"}</p>
                    <p className="text-xs text-app-muted">{team.apiId ?? ""}</p>
                  </AdminTd>
                  <AdminTd>
                    {team._count.homeMatches + team._count.awayMatches} partidas
                  </AdminTd>
                  <AdminTd>{formatDate(team.createdAt)}</AdminTd>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTable>
          <AdminPagination
            page={result.data.page}
            pageSize={result.data.pageSize}
            pathname="/admin/times"
            searchParams={params}
            total={result.data.total}
          />
        </>
      )}
    </PageShell>
  );
}
