import { LeagueStatus } from "@prisma/client";
import Link from "next/link";
import type { Route } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  deleteLeagueAction,
  updateLeagueStatusAction
} from "@/features/admin/actions/admin-actions";
import { AdminAlert } from "@/features/admin/components/admin-alert";
import { AdminDeleteButton } from "@/features/admin/components/admin-delete-button";
import { AdminEmpty } from "@/features/admin/components/admin-empty";
import { AdminFilterForm } from "@/features/admin/components/admin-filter-form";
import { AdminPagination } from "@/features/admin/components/admin-pagination";
import { AdminSelect } from "@/features/admin/components/admin-select";
import { AdminStatusBadge } from "@/features/admin/components/admin-status-badge";
import {
  AdminTable,
  AdminTableBody,
  AdminTableHead,
  AdminTd,
  AdminTh
} from "@/features/admin/components/admin-table";
import { getAdminLeagues, toCurrency } from "@/features/admin/data/admin-data";
import { CreateLeagueForm } from "@/features/leagues/components/create-league-form";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;
type LeaguesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const deleteLeagueFormAction = deleteLeagueAction as unknown as FormAction;
const updateLeagueStatusFormAction = updateLeagueStatusAction as unknown as FormAction;

export default async function AdminLeaguesPage({ searchParams }: LeaguesPageProps) {
  const params = await searchParams;
  const result = await getAdminLeagues(params);
  const leagues = result.data.items;

  return (
    <PageShell
      description="Acompanhe ligas criadas, responsaveis, participantes e status operacional."
      eyebrow="Administracao"
      title="Ligas"
    >
      <AdminAlert message={result.ok ? undefined : result.message} />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Nova liga</CardTitle>
          <CardDescription>
            Crie uma liga para um usuario cadastrado ou deixe o dono em branco para usar seu admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateLeagueForm admin />
        </CardContent>
      </Card>

      <AdminFilterForm placeholder="Nome da liga ou e-mail do dono" query={String(params.q ?? "")}>
        <AdminSelect defaultValue={String(params.status ?? "")} label="Status" name="status">
          <option value="">Todos</option>
          {Object.values(LeagueStatus).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </AdminSelect>
      </AdminFilterForm>

      {leagues.length === 0 ? (
        <AdminEmpty />
      ) : (
        <>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTh>Liga</AdminTh>
                <AdminTh>Dono</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Participantes</AdminTh>
                <AdminTh>Financeiro</AdminTh>
                <AdminTh>Acoes</AdminTh>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {leagues.map((league) => (
                <tr key={league.id}>
                  <AdminTd>
                    <div>
                      <p className="font-semibold">{league.name}</p>
                      <p className="text-xs text-app-muted">{league.visibility}</p>
                      {league.inviteCode ? (
                        <p className="text-xs font-semibold text-brand-gold">
                          Codigo: {league.inviteCode}
                        </p>
                      ) : null}
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <div>
                      <p>{league.owner.name}</p>
                      <p className="text-xs text-app-muted">{league.owner.email}</p>
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <AdminStatusBadge value={league.status} />
                  </AdminTd>
                  <AdminTd>{league._count.members}</AdminTd>
                  <AdminTd>
                    <p>{toCurrency(league.entryFee)}</p>
                    <p className="text-xs text-app-muted">{league._count.payments} pagamentos</p>
                  </AdminTd>
                  <AdminTd>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="inline-flex h-10 items-center justify-center rounded-button border border-app-border px-3 text-sm font-semibold text-app-foreground transition hover:border-brand-gold hover:text-brand-gold"
                        href={`/admin/rodadas?league=${league.id}` as Route}
                      >
                        Rodadas
                      </Link>
                      <form action={updateLeagueStatusFormAction} className="flex gap-2">
                        <input name="leagueId" type="hidden" value={league.id} />
                        <AdminSelect
                          aria-label="Status"
                          className="w-36"
                          defaultValue={league.status}
                          name="status"
                        >
                          {Object.values(LeagueStatus).map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </AdminSelect>
                        <button
                          className="h-10 rounded-button bg-brand-blue px-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                          type="submit"
                        >
                          Salvar
                        </button>
                      </form>
                      <form action={deleteLeagueFormAction}>
                        <input name="leagueId" type="hidden" value={league.id} />
                        <AdminDeleteButton
                          confirmMessage={`Excluir a liga "${league.name}"? Rodadas, partidas, palpites, ranking, pagamentos e membros vinculados tambem serao removidos.`}
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
            pathname="/admin/ligas"
            searchParams={params}
            total={result.data.total}
          />
        </>
      )}
    </PageShell>
  );
}
