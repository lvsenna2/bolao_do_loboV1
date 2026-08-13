import { PageShell } from "@/components/layout/page-shell";
import { AdminEmpty } from "@/features/admin/components/admin-empty";
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
  approveWithdrawalFormAction,
  markWithdrawalPaidFormAction,
  rejectWithdrawalFormAction
} from "@/features/wallet/actions/withdrawal-actions";
import {
  getPendingWithdrawalsForAdmin,
  getReviewedWithdrawalsForAdmin
} from "@/features/wallet/data/wallet-data";
import { formatCents } from "@/features/wallet/services/wallet-service";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";
import { requireAdmin } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const inputClass =
  "h-10 w-full rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none focus:border-brand-gold";

export default async function AdminWithdrawalsPage() {
  await requireAdmin();
  const [pending, reviewed] = await Promise.all([
    getPendingWithdrawalsForAdmin(),
    getReviewedWithdrawalsForAdmin()
  ]);

  return (
    <PageShell
      description="O valor ja saiu da carteira do usuario. Aprove, faca o Pix por fora e marque como pago."
      eyebrow="Administracao"
      title="Saques"
    >
      {pending.length === 0 ? (
        <AdminEmpty />
      ) : (
        <AdminTable>
          <AdminTableHead>
            <tr>
              <AdminTh>Usuario</AdminTh>
              <AdminTh>Valor</AdminTh>
              <AdminTh>Chave Pix</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Acoes</AdminTh>
            </tr>
          </AdminTableHead>
          <AdminTableBody>
            {pending.map((withdrawal) => (
              <tr key={withdrawal.id}>
                <AdminTd>
                  <p className="font-semibold">{withdrawal.user.name}</p>
                  <p className="text-xs text-app-muted">
                    @{withdrawal.user.username} | {withdrawal.user.email}
                  </p>
                </AdminTd>
                <AdminTd>
                  <p className="font-semibold">{formatCents(withdrawal.amountCents)}</p>
                  <p className="text-xs text-app-muted">
                    Pedido: {formatDateTimeInSaoPaulo(withdrawal.createdAt)}
                  </p>
                </AdminTd>
                <AdminTd>
                  <p className="break-all">{withdrawal.pixKey}</p>
                  <p className="text-xs text-app-muted">
                    {withdrawal.pixKeyType} | {withdrawal.pixKeyOwnerName}
                  </p>
                </AdminTd>
                <AdminTd>
                  <AdminStatusBadge value={withdrawal.status} />
                </AdminTd>
                <AdminTd>
                  <div className="space-y-2">
                    {withdrawal.status === "REQUESTED" ? (
                      <form action={approveWithdrawalFormAction}>
                        <input name="withdrawalId" type="hidden" value={withdrawal.id} />
                        <AdminSubmitButton
                          className="h-10 rounded-button bg-brand-gold px-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                          pendingLabel="Aprovando..."
                        >
                          Aprovar
                        </AdminSubmitButton>
                      </form>
                    ) : (
                      <form action={markWithdrawalPaidFormAction} className="flex gap-2">
                        <input name="withdrawalId" type="hidden" value={withdrawal.id} />
                        <input
                          aria-label="Comprovante ou ID da transacao"
                          className={inputClass}
                          name="receiptRef"
                          placeholder="ID do comprovante"
                        />
                        <AdminSubmitButton
                          className="h-10 shrink-0 rounded-button bg-emerald-500 px-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                          pendingLabel="Salvando..."
                        >
                          Marcar pago
                        </AdminSubmitButton>
                      </form>
                    )}

                    <form action={rejectWithdrawalFormAction} className="flex gap-2">
                      <input name="withdrawalId" type="hidden" value={withdrawal.id} />
                      <input
                        aria-label="Motivo da recusa"
                        className={inputClass}
                        name="reason"
                        placeholder="Motivo da recusa"
                        required
                      />
                      <AdminSubmitButton
                        className="h-10 shrink-0 rounded-button border border-red-500/40 px-3 text-sm font-semibold text-red-500 transition hover:bg-red-500/10"
                        pendingLabel="Recusando..."
                      >
                        Recusar
                      </AdminSubmitButton>
                    </form>
                  </div>
                </AdminTd>
              </tr>
            ))}
          </AdminTableBody>
        </AdminTable>
      )}

      {reviewed.length ? (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-app-muted">
            Historico
          </h2>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTh>Usuario</AdminTh>
                <AdminTh>Valor</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Conclusao</AdminTh>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {reviewed.map((withdrawal) => (
                <tr key={withdrawal.id}>
                  <AdminTd>
                    <p className="font-semibold">{withdrawal.user.name}</p>
                    <p className="text-xs text-app-muted">{withdrawal.user.email}</p>
                  </AdminTd>
                  <AdminTd>{formatCents(withdrawal.amountCents)}</AdminTd>
                  <AdminTd>
                    <AdminStatusBadge value={withdrawal.status} />
                    {withdrawal.adminNote ? (
                      <p className="text-xs text-app-muted">{withdrawal.adminNote}</p>
                    ) : null}
                  </AdminTd>
                  <AdminTd>
                    <p>{formatDateTimeInSaoPaulo(withdrawal.paidAt ?? withdrawal.reviewedAt)}</p>
                    {withdrawal.receiptRef ? (
                      <p className="text-xs text-app-muted">{withdrawal.receiptRef}</p>
                    ) : null}
                  </AdminTd>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTable>
        </div>
      ) : null}
    </PageShell>
  );
}
