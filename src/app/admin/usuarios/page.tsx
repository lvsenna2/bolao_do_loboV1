import { AccountStatus, UserRole } from "@prisma/client";

import { PageShell } from "@/components/layout/page-shell";
import { AdminAlert } from "@/features/admin/components/admin-alert";
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
import {
  sendOpenGuessReminderEmailsAction,
  sendEmailIntegrationAnnouncementAction,
  sendPendingWelcomeEmailsAction,
  softDeleteUserAction,
  updateUserRoleAction,
  updateUserStatusAction
} from "@/features/admin/actions/admin-actions";
import { getAdminUsers } from "@/features/admin/data/admin-data";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;
type UsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const softDeleteUserFormAction = softDeleteUserAction as unknown as FormAction;
const sendOpenGuessReminderEmailsFormAction =
  sendOpenGuessReminderEmailsAction as unknown as FormAction;
const sendEmailIntegrationAnnouncementFormAction =
  sendEmailIntegrationAnnouncementAction as unknown as FormAction;
const sendPendingWelcomeEmailsFormAction = sendPendingWelcomeEmailsAction as unknown as FormAction;
const updateUserRoleFormAction = updateUserRoleAction as unknown as FormAction;
const updateUserStatusFormAction = updateUserStatusAction as unknown as FormAction;

function formatDate(date: Date | null) {
  return date ? formatDateTimeInSaoPaulo(date) : "Nunca";
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

      <div className="rounded-card border border-app-border bg-app-surface p-5 shadow-soft">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-app-foreground">Central de e-mails</h2>
          <p className="mt-1 max-w-3xl text-sm text-app-muted">
            Envie comunicados para usuarios ativos com seguranca. Os lembretes de palpites sao
            enviados apenas para quem tem partidas abertas sem palpite e nao repetem no mesmo dia.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-control border border-brand-gold/30 bg-brand-gold/10 p-4">
            <h3 className="font-semibold text-app-foreground">Lembrete de palpites</h3>
            <p className="mt-1 text-sm text-app-muted">
              Avisa usuarios com rodadas abertas e palpites pendentes nas ligas em que participam.
            </p>
            <form action={sendOpenGuessReminderEmailsFormAction} className="mt-4">
              <AdminSubmitButton
                className="h-10 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
                pendingLabel="Enviando..."
              >
                Enviar lembretes
              </AdminSubmitButton>
            </form>
          </div>
          <div>
            <h3 className="font-semibold text-app-foreground">Aviso da integracao</h3>
            <p className="mt-1 text-sm text-app-muted">
              Envie um aviso unico para usuarios ativos informando que a recuperacao de senha por
              e-mail esta disponivel.
            </p>
            <form action={sendEmailIntegrationAnnouncementFormAction} className="mt-4">
              <AdminSubmitButton
                className="h-10 rounded-button border border-app-border px-4 text-sm font-semibold text-app-foreground transition hover:border-brand-gold hover:text-brand-gold"
                pendingLabel="Enviando..."
              >
                Enviar aviso
              </AdminSubmitButton>
            </form>
          </div>
          <div>
            <h3 className="font-semibold text-app-foreground">Boas-vindas pendentes</h3>
            <p className="mt-1 text-sm text-app-muted">
              Envia boas-vindas somente para usuarios ativos que ainda nao receberam esse e-mail.
            </p>
            <form action={sendPendingWelcomeEmailsFormAction} className="mt-4">
              <AdminSubmitButton
                className="h-10 rounded-button border border-app-border px-4 text-sm font-semibold text-app-foreground transition hover:border-brand-gold hover:text-brand-gold"
                pendingLabel="Enviando..."
              >
                Enviar pendentes
              </AdminSubmitButton>
            </form>
          </div>
        </div>
      </div>

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
                      <AdminSubmitButton
                        className="h-10 rounded-button bg-brand-blue px-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                        pendingLabel="Salvando..."
                      >
                        Salvar
                      </AdminSubmitButton>
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
                        <AdminSubmitButton
                          className="h-9 rounded-button border border-app-border px-3 text-sm font-semibold text-app-foreground transition hover:border-brand-gold hover:text-brand-gold"
                          pendingLabel="Processando..."
                        >
                          {user.status === "BLOCKED" ? "Desbloquear" : "Bloquear"}
                        </AdminSubmitButton>
                      </form>
                      <form action={softDeleteUserFormAction}>
                        <input name="userId" type="hidden" value={user.id} />
                        <AdminSubmitButton
                          className="h-9 rounded-button border border-red-500/30 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-500/10 dark:text-red-300"
                          pendingLabel="Processando..."
                        >
                          Excluir
                        </AdminSubmitButton>
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
