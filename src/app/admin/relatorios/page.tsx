import { Download, FileText } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const reports = [
  {
    description: "Exporta usuarios, e-mails, permissoes, status e data de cadastro.",
    href: "/admin/relatorios/usuarios",
    title: "Relatorio de usuarios"
  },
  {
    description: "Exporta pagamentos, valores, status, usuario e liga vinculada.",
    href: "/admin/relatorios/pagamentos",
    title: "Relatorio de pagamentos"
  },
  {
    description: "Exporta registros de auditoria com acao, modulo, usuario e data.",
    href: "/admin/relatorios/auditoria",
    title: "Relatorio de auditoria"
  }
];

export default function AdminReportsPage() {
  return (
    <PageShell
      description="Exportacoes administrativas previstas para acompanhamento operacional."
      eyebrow="Administracao"
      title="Relatorios"
    >
      <section className="grid gap-4 md:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.href}>
            <CardHeader>
              <span className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-button bg-brand-gold/10 text-brand-gold">
                <FileText aria-hidden className="h-5 w-5" />
              </span>
              <CardTitle>{report.title}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                className={buttonVariants({ size: "sm", variant: "secondary" })}
                href={report.href as Route}
              >
                <Download aria-hidden className="h-4 w-4" />
                Baixar CSV
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>
    </PageShell>
  );
}
