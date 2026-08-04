import { Activity, Database, HandCoins, HeartHandshake, Users } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { ApiFundingCheckout } from "@/features/api-funding/components/api-funding-checkout";
import { getApiFundingOverview } from "@/features/api-funding/data";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

function currency(value: number) {
  return value.toLocaleString("pt-BR", { currency: "BRL", style: "currency" });
}

export default async function ApiFundingPage() {
  const user = await requireUser();
  const overview = await getApiFundingOverview(user.id);

  const stats = [
    {
      icon: Activity,
      label: "Arrecadado neste mes",
      value: currency(overview.currentMonthAmount),
      detail: `${overview.currentMonthCount} contribuicoes confirmadas`
    },
    {
      icon: Database,
      label: "Arrecadacao total",
      value: currency(overview.allTimeAmount),
      detail: `${overview.allTimeCount} contribuicoes recebidas`
    },
    {
      icon: Users,
      label: "Apoiadores",
      value: String(overview.contributorCount),
      detail: "participantes que ja contribuiram"
    },
    {
      icon: HeartHandshake,
      label: "Seu apoio total",
      value: currency(overview.ownAmount),
      detail: `${overview.ownCount} contribuicoes suas`
    }
  ];

  return (
    <PageShell
      description="Acompanhe a arrecadacao e contribua para manter a integracao de dados esportivos."
      eyebrow="Transparencia"
      title="Apoie a API"
    >
      <section className="relative mb-6 overflow-hidden rounded-card border border-brand-gold/35 bg-black p-5 text-white sm:p-7">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(242,185,28,0.2),transparent_38%)]"
        />
        <div className="relative max-w-3xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            <HandCoins className="h-4 w-4" /> Financiamento coletivo
          </p>
          <h2 className="mt-3 text-2xl font-semibold">Dados atualizados com a ajuda da comunidade</h2>
          <p className="mt-2 text-sm leading-6 text-white/70">
            A API-Football fornece jogos, placares, escudos, escalacoes e estatisticas. Nesta aba,
            todos acompanham quanto ja foi arrecadado para ajudar a manter essa estrutura ativa.
          </p>
        </div>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article
              className="rounded-card border border-app-border bg-app-surface p-4"
              key={stat.label}
            >
              <div className="flex items-center gap-2 text-app-muted">
                <Icon className="h-4 w-4 text-brand-gold" />
                <span className="text-xs font-medium uppercase tracking-[0.08em]">{stat.label}</span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-app-foreground">{stat.value}</p>
              <p className="mt-1 text-xs text-app-muted">{stat.detail}</p>
            </article>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <ApiFundingCheckout initialPayment={overview.pendingPayment} />

        <section className="rounded-card border border-app-border bg-app-surface p-4 sm:p-5">
          <h2 className="text-lg font-semibold">Contribuicoes recentes</h2>
          <p className="mt-1 text-sm text-app-muted">
            Valores confirmados, sem exposicao do nome dos apoiadores.
          </p>
          <div className="mt-4 space-y-2">
            {overview.recent.length ? (
              overview.recent.map((contribution) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-control border border-app-border bg-app-background p-3"
                  key={contribution.id}
                >
                  <div>
                    <p className="text-sm font-semibold">Contribuicao confirmada</p>
                    <p className="text-xs text-app-muted">
                      {formatDateTimeInSaoPaulo(contribution.paidAt)}
                    </p>
                  </div>
                  <strong className="text-brand-gold">{currency(contribution.amount)}</strong>
                </div>
              ))
            ) : (
              <div className="rounded-control border border-dashed border-app-border p-6 text-center text-sm text-app-muted">
                A arrecadacao ainda nao recebeu contribuicoes confirmadas.
              </div>
            )}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
