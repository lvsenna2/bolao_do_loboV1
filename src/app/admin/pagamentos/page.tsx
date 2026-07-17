import { PaymentStatus } from "@prisma/client";

import { PageShell } from "@/components/layout/page-shell";
import { updatePaymentStatusAction } from "@/features/admin/actions/admin-actions";
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
import { getAdminPayments, toCurrency } from "@/features/admin/data/admin-data";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;
type PaymentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const updatePaymentStatusFormAction = updatePaymentStatusAction as unknown as FormAction;

function formatDate(date: Date | null) {
  return formatDateTimeInSaoPaulo(date);
}

export default async function AdminPaymentsPage({ searchParams }: PaymentsPageProps) {
  const params = await searchParams;
  const result = await getAdminPayments(params);
  const payments = result.data.items;

  return (
    <PageShell
      description="Acompanhe transacoes, status de pagamento e confirmacoes manuais."
      eyebrow="Administracao"
      title="Pagamentos"
    >
      <AdminAlert message={result.ok ? undefined : result.message} />

      <AdminFilterForm placeholder="E-mail, liga ou transacao" query={String(params.q ?? "")}>
        <AdminSelect defaultValue={String(params.status ?? "")} label="Status" name="status">
          <option value="">Todos</option>
          {Object.values(PaymentStatus).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </AdminSelect>
      </AdminFilterForm>

      {payments.length === 0 ? (
        <AdminEmpty />
      ) : (
        <>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTh>Usuario</AdminTh>
                <AdminTh>Liga</AdminTh>
                <AdminTh>Valor</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Datas</AdminTh>
                <AdminTh>Acoes</AdminTh>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <AdminTd>
                    <div>
                      <p className="font-semibold">{payment.user.name}</p>
                      <p className="text-xs text-app-muted">{payment.user.email}</p>
                    </div>
                  </AdminTd>
                  <AdminTd>{payment.league.name}</AdminTd>
                  <AdminTd>
                    <p>{toCurrency(payment.amount)}</p>
                    <p className="text-xs text-app-muted">{payment.gateway}</p>
                  </AdminTd>
                  <AdminTd>
                    <AdminStatusBadge value={payment.status} />
                  </AdminTd>
                  <AdminTd>
                    <p>Criado: {formatDate(payment.createdAt)}</p>
                    <p className="text-xs text-app-muted">Pago: {formatDate(payment.paidAt)}</p>
                  </AdminTd>
                  <AdminTd>
                    <form action={updatePaymentStatusFormAction} className="flex gap-2">
                      <input name="paymentId" type="hidden" value={payment.id} />
                      <AdminSelect
                        aria-label="Status"
                        className="w-36"
                        defaultValue={payment.status}
                        name="status"
                      >
                        {Object.values(PaymentStatus).map((status) => (
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
                  </AdminTd>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTable>
          <AdminPagination
            page={result.data.page}
            pageSize={result.data.pageSize}
            pathname="/admin/pagamentos"
            searchParams={params}
            total={result.data.total}
          />
        </>
      )}
    </PageShell>
  );
}
