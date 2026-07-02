import { AccountStatus, UserRole } from "@prisma/client";

import { PageShell } from "@/components/layout/page-shell";
import { AdminAlert } from "@/features/admin/components/admin-alert";
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
import {
  softDeleteUserAction,
  updateUserRoleAction,
  updateUserStatusAction
} from "@/features/admin/actions/admin-actions";
import { getAdminUsers } from "@/features/admin/data/admin-data";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;
type UsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const softDeleteUserFormAction = softDeleteUserAction as unknown as FormAction;
const updateUserRoleFormAction = updateUserRoleAction as unknown as FormAction;
const updateUserStatusFormAction = updateUserStatusAction as unknown as FormAction;

function formatDate(date: Date | null) {
  if (!date) {
    return "Nunca";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  const params = await searchParams;
  const result = await getAdminUsers(params);
  const users = result.data.items;

  return (
    <PageShell
      description="Pesquise, filtre, bloqueie contas, altere permissoes e acompanhe historico basico."
      eyebrow="Administracao"
      title="Usuarios"
    >
      <AdminAlert message={result.ok ? undefined : result.message} />

      <AdminFilterForm placeholder="Nome, e-mail ou username" query={String(params.q ?? "")}>
        <AdminSelect defaultValue={String(params.role ?? "")} label="Permissao" name="role">
          <option value="">Todas</option>
          {Object.values(UserRole).map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </AdminSelect>
        <AdminSelect defaultValue={String(params.status ?? "")} label="Status" name="status">
          <option value="">Todos ativos</option>
          {Object.values(AccountStatus).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </AdminSelect>
      </AdminFilterForm>

      {users.length === 0 ? (
        <AdminEmpty />
      ) : (
        <>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTh>Usuario</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Permissao</AdminTh>
                <AdminTh>Atividade</AdminTh>
                <AdminTh>Acoes</AdminTh>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {users.map((user) => (
                <tr key={user.id}>
                  <AdminTd>
                    <div>
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-xs text-app-muted">@{user.username}</p>
                      <p className="text-xs text-app-muted">{user.email}</p>
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <AdminStatusBadge value={user.status} />
                  </AdminTd>
                  <AdminTd>
                    <form action={updateUserRoleFormAction} className="flex items-center gap-2">
                      <input name="userId" type="hidden" value={user.id} />
                      <AdminSelect
                        aria-label="Permissao"
                        className="w-36"
                        defaultValue={user.role}
                        name="role"
                      >
                        {Object.values(UserRole).map((role) => (
                          <option key={role} value={role}>
                            {role}
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
                  </AdminTd>
                  <AdminTd>
                    <div className="text-sm">
                      <p>Nivel {user.level}</p>
                      <p className="text-xs text-app-muted">XP {user.xp}</p>
                      <p className="text-xs text-app-muted">
                        Login: {formatDate(user.lastLoginAt)}
                      </p>
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <div className="flex flex-wrap gap-2">
                      <form action={updateUserStatusFormAction}>
                        <input name="userId" type="hidden" value={user.id} />
                        <input
                          name="status"
                          type="hidden"
                          value={user.status === "BLOCKED" ? "ACTIVE" : "BLOCKED"}
                        />
                        <button
                          className="h-9 rounded-button border border-app-border px-3 text-sm font-semibold text-app-foreground transition hover:border-brand-gold hover:text-brand-gold"
                          type="submit"
                        >
                          {user.status === "BLOCKED" ? "Desbloquear" : "Bloquear"}
                        </button>
                      </form>
                      <form action={softDeleteUserFormAction}>
                        <input name="userId" type="hidden" value={user.id} />
                        <button
                          className="h-9 rounded-button border border-red-500/30 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-500/10 dark:text-red-300"
                          type="submit"
                        >
                          Excluir
                        </button>
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
            pathname="/admin/usuarios"
            searchParams={params}
            total={result.data.total}
          />
        </>
      )}
    </PageShell>
  );
}
