import { AlertTriangle, CreditCard, Trophy, Users } from "lucide-react";
import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminAlert } from "@/features/admin/components/admin-alert";
import { AdminStatCard } from "@/features/admin/components/admin-stat-card";
import { AdminStatusBadge } from "@/features/admin/components/admin-status-badge";
import { buttonVariants } from "@/components/ui/button";
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
      description="Indicadores essenciais e acessos rapidos da operacao."
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
          description="Ligas criadas"
          icon={Trophy}
          label="Ligas"
          value={data.leagues}
        />
        <AdminStatCard
          description="Aguardando confirmacao"
          icon={CreditCard}
          label="Pagamentos pendentes"
          value={data.pendingPayments}
        />
        <AdminStatCard
          description="Eventos marcados como erro"
          icon={AlertTriangle}
          label="Erros"
          value={data.errors}
        />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
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
            <CardTitle>Acessos rapidos</CardTitle>
            <CardDescription>Abra diretamente as areas mais usadas.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Link className={buttonVariants({ variant: "secondary" })} href="/admin/rodadas">
              Gerenciar rodadas
            </Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/admin/pagamentos">
              Ver pagamentos
            </Link>
            <Link className={buttonVariants({ variant: "secondary" })} href="/admin/auditoria">
              Abrir auditoria
            </Link>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
