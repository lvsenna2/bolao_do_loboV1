import { PageShell } from "@/components/layout/page-shell";
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
import { getAdminAuditLogs } from "@/features/admin/data/admin-data";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";

export const dynamic = "force-dynamic";

type AuditPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const inputClass =
  "h-10 rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition placeholder:text-app-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

function formatDate(date: Date) {
  return formatDateTimeInSaoPaulo(date, { seconds: true });
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return JSON.stringify(value);
}

export default async function AdminAuditPage({ searchParams }: AuditPageProps) {
  const params = await searchParams;
  const result = await getAdminAuditLogs(params);
  const logs = result.data.items;

  return (
    <PageShell
      description="Rastreamento de operacoes criticas executadas por usuarios, administradores e sistema."
      eyebrow="Administracao"
      title="Auditoria"
    >
      <AdminAlert message={result.ok ? undefined : result.message} />

      <AdminFilterForm placeholder="Usuario ou ID da entidade" query={String(params.q ?? "")}>
        <label className="space-y-2">
          <span className="text-sm font-medium text-app-foreground">Modulo</span>
          <input
            className={inputClass}
            defaultValue={String(params.entity ?? "")}
            name="entity"
            placeholder="User, Payment..."
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-app-foreground">Acao</span>
          <input
            className={inputClass}
            defaultValue={String(params.action ?? "")}
            name="action"
            placeholder="admin.user..."
          />
        </label>
      </AdminFilterForm>

      {logs.length === 0 ? (
        <AdminEmpty />
      ) : (
        <>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTh>Data</AdminTh>
                <AdminTh>Usuario</AdminTh>
                <AdminTh>Modulo</AdminTh>
                <AdminTh>Acao</AdminTh>
                <AdminTh>Detalhes</AdminTh>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <AdminTd>{formatDate(log.createdAt)}</AdminTd>
                  <AdminTd>
                    <div>
                      <p>{log.user?.name ?? "Sistema"}</p>
                      <p className="text-xs text-app-muted">{log.user?.email ?? "-"}</p>
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <p>{log.entity}</p>
                    <p className="text-xs text-app-muted">{log.entityId ?? "-"}</p>
                  </AdminTd>
                  <AdminTd>{log.action}</AdminTd>
                  <AdminTd>
                    <details className="max-w-xs">
                      <summary className="cursor-pointer text-brand-blue">Valores</summary>
                      <pre className="mt-2 max-h-32 overflow-auto rounded-control bg-app-elevated p-2 text-xs text-app-muted">
                        {stringifyValue({
                          newValue: log.newValue,
                          oldValue: log.oldValue
                        })}
                      </pre>
                    </details>
                  </AdminTd>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTable>
          <AdminPagination
            page={result.data.page}
            pageSize={result.data.pageSize}
            pathname="/admin/auditoria"
            searchParams={params}
            total={result.data.total}
          />
        </>
      )}
    </PageShell>
  );
}
