import { ChampionshipStatus } from "@prisma/client";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createChampionshipAction,
  deleteChampionshipAction,
  updateChampionshipStatusAction
} from "@/features/admin/actions/admin-actions";
import { AdminAlert } from "@/features/admin/components/admin-alert";
import { AdminDeleteButton } from "@/features/admin/components/admin-delete-button";
import { AdminEmpty } from "@/features/admin/components/admin-empty";
import { AdminFilterForm } from "@/features/admin/components/admin-filter-form";
import { AdminPagination } from "@/features/admin/components/admin-pagination";
import { AdminSelect } from "@/features/admin/components/admin-select";
import { AdminStatusBadge } from "@/features/admin/components/admin-status-badge";
import { AdminSubmitButton } from "@/features/admin/components/admin-submit-button";
import {
  AdminTable,
  AdminTableBody,
  AdminTableHead,
  AdminTd,
  AdminTh
} from "@/features/admin/components/admin-table";
import { getAdminChampionships } from "@/features/admin/data/admin-data";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;
type ChampionshipsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const createChampionshipFormAction = createChampionshipAction as unknown as FormAction;
const deleteChampionshipFormAction = deleteChampionshipAction as unknown as FormAction;
const updateChampionshipStatusFormAction = updateChampionshipStatusAction as unknown as FormAction;

const inputClass =
  "h-10 rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition placeholder:text-app-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

export default async function AdminChampionshipsPage({ searchParams }: ChampionshipsPageProps) {
  const params = await searchParams;
  const result = await getAdminChampionships(params);
  const championships = result.data.items;

  return (
    <PageShell
      description="Cadastre competicoes, associe temporada inicial e controle o status operacional."
      eyebrow="Administracao"
      title="Campeonatos"
    >
      <AdminAlert message={result.ok ? undefined : result.message} />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Novo campeonato</CardTitle>
          <CardDescription>Campos previstos pela especificacao oficial.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createChampionshipFormAction} className="grid gap-3 lg:grid-cols-4">
            <input className={inputClass} name="name" placeholder="Nome" required />
            <input className={inputClass} name="country" placeholder="Pais" required />
            <input
              className={inputClass}
              max="2200"
              min="1900"
              name="seasonYear"
              placeholder="Temporada"
              type="number"
            />
            <AdminSelect defaultValue="ACTIVE" name="status">
              {Object.values(ChampionshipStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </AdminSelect>
            <input className={inputClass} name="logo" placeholder="URL do escudo" type="url" />
            <input className={inputClass} name="primaryColor" placeholder="#F2B91C" />
            <input className={inputClass} name="provider" placeholder="API externa" />
            <input className={inputClass} name="apiId" placeholder="ID na API" type="number" />
            <textarea
              className="min-h-24 rounded-control border border-app-border bg-app-background px-3 py-2 text-sm text-app-foreground outline-none transition placeholder:text-app-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 lg:col-span-3"
              name="description"
              placeholder="Descricao"
            />
            <AdminSubmitButton
              className="h-10 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 lg:self-end"
              pendingLabel="Salvando..."
            >
              Cadastrar
            </AdminSubmitButton>
          </form>
        </CardContent>
      </Card>

      <AdminFilterForm placeholder="Nome ou pais" query={String(params.q ?? "")}>
        <AdminSelect defaultValue={String(params.status ?? "")} label="Status" name="status">
          <option value="">Todos</option>
          {Object.values(ChampionshipStatus).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </AdminSelect>
      </AdminFilterForm>

      {championships.length === 0 ? (
        <AdminEmpty />
      ) : (
        <>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTh>Campeonato</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Temporadas</AdminTh>
                <AdminTh>API</AdminTh>
                <AdminTh>Acoes</AdminTh>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {championships.map((championship) => (
                <tr key={championship.id}>
                  <AdminTd>
                    <div className="flex items-center gap-3">
                      <span
                        className="h-4 w-4 rounded-full border border-app-border"
                        style={{ backgroundColor: championship.primaryColor ?? "#F2B91C" }}
                      />
                      <div>
                        <p className="font-semibold">{championship.name}</p>
                        <p className="text-xs text-app-muted">{championship.country}</p>
                      </div>
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <AdminStatusBadge value={championship.status} />
                  </AdminTd>
                  <AdminTd>{championship._count.seasons}</AdminTd>
                  <AdminTd>
                    <p>{championship.provider ?? "Manual"}</p>
                    <p className="text-xs text-app-muted">{championship.apiId ?? ""}</p>
                  </AdminTd>
                  <AdminTd>
                    <div className="flex flex-wrap gap-2">
                      <form action={updateChampionshipStatusFormAction} className="flex gap-2">
                        <input name="championshipId" type="hidden" value={championship.id} />
                        <AdminSelect
                          aria-label="Status"
                          className="w-36"
                          defaultValue={championship.status}
                          name="status"
                        >
                          {Object.values(ChampionshipStatus).map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </AdminSelect>
                        <AdminSubmitButton
                          className="h-10 rounded-button bg-brand-gold px-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                          pendingLabel="Salvando..."
                        >
                          Salvar
                        </AdminSubmitButton>
                      </form>
                      <form action={deleteChampionshipFormAction}>
                        <input name="championshipId" type="hidden" value={championship.id} />
                        <AdminDeleteButton
                          confirmMessage={`Excluir o campeonato "${championship.name}"? Rodadas, partidas, palpites e rankings vinculados tambem serao removidos.`}
                        />
                      </form>
                    </div>
                  </AdminTd>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTable>
          <AdminPagination
            page={result.data.page}
            pageSize={result.data.pageSize}
            pathname="/admin/campeonatos"
            searchParams={params}
            total={result.data.total}
          />
        </>
      )}
    </PageShell>
  );
}
