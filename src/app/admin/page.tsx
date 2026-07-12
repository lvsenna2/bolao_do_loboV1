import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Eye,
  ShieldCheck,
  Trophy,
  Users
} from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminAlert } from "@/features/admin/components/admin-alert";
import { AdminStatCard } from "@/features/admin/components/admin-stat-card";
import { AdminStatusBadge } from "@/features/admin/components/admin-status-badge";
import {
  AdminTable,
  AdminTableBody,
  AdminTableHead,
  AdminTd,
  AdminTh
} from "@/features/admin/components/admin-table";
import { getAdminDashboardData } from "@/features/admin/data/admin-data";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const result = await getAdminDashboardData();
  const data = result.data;

  return (
    <PageShell
      description="Visao consolidada da operacao, pagamentos, usuarios e auditoria."
      eyebrow="Administracao"
      title="Painel administrativo"
    >
      <AdminAlert message={result.ok ? undefined : result.message} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          description="Contas cadastradas"
          icon={Users}
          label="Usuarios"
          value={data.users}
        />
        <AdminStatCard
          description="Contas com status ativo"
          icon={ShieldCheck}
          label="Usuarios ativos"
          value={data.activeUsers}
        />
        <AdminStatCard
          description="Ligas criadas"
          icon={Trophy}
          label="Ligas"
          value={data.leagues}
        />
        <AdminStatCard
          description="Partidas cadastradas"
          icon={CalendarDays}
          label="Partidas"
          value={data.matches}
        />
        <AdminStatCard
          description="Aguardando confirmacao"
          icon={CreditCard}
          label="Pagamentos pendentes"
          value={data.pendingPayments}
        />
        <AdminStatCard
          description="Pagamentos aprovados"
          icon={ClipboardList}
          label="Receita"
          value={data.revenue}
        />
        <AdminStatCard
          description="Logins registrados hoje"
          icon={Eye}
          label="Acessos do dia"
          value={data.accessToday}
        />
        <AdminStatCard
          description="Eventos marcados como erro"
          icon={AlertTriangle}
          label="Erros"
          value={data.errors}
        />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usuarios recentes</CardTitle>
            <CardDescription>Ultimas contas cadastradas na plataforma.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <AdminTh>Usuario</AdminTh>
                  <AdminTh>Status</AdminTh>
                  <AdminTh>Criado em</AdminTh>
                </tr>
              </AdminTableHead>
              <AdminTableBody>
                {data.recentUsers.map((user) => (
                  <tr key={user.id}>
                    <AdminTd>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-app-muted">{user.email}</p>
                      </div>
                    </AdminTd>
                    <AdminTd>
                      <AdminStatusBadge value={user.status} />
                    </AdminTd>
                    <AdminTd>{formatDateTimeInSaoPaulo(user.createdAt)}</AdminTd>
                  </tr>
                ))}
              </AdminTableBody>
            </AdminTable>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auditoria recente</CardTitle>
            <CardDescription>Ultimas operacoes registradas no sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <AdminTh>Acao</AdminTh>
                  <AdminTh>Usuario</AdminTh>
                  <AdminTh>Data</AdminTh>
                </tr>
              </AdminTableHead>
              <AdminTableBody>
                {data.recentAuditLogs.map((log) => (
                  <tr key={log.id}>
                    <AdminTd>{log.action}</AdminTd>
                    <AdminTd>{log.user?.email ?? "Sistema"}</AdminTd>
                    <AdminTd>{formatDateTimeInSaoPaulo(log.createdAt)}</AdminTd>
                  </tr>
                ))}
              </AdminTableBody>
            </AdminTable>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
