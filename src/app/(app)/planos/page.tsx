import { Crown } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { PlansCheckout } from "@/features/subscriptions/components/plans-checkout";
import { getSubscriptionPageData } from "@/features/subscriptions/data";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const user = await requireUser();
  const data = await getSubscriptionPageData(user.id);
  return (
    <PageShell
      description="Escolha seu plano, acompanhe os beneficios e gerencie sua assinatura."
      eyebrow="Clube do Lobo"
      title="Planos"
    >
      <section className="relative mb-6 overflow-hidden rounded-card border border-brand-gold/35 bg-black p-5 text-white sm:p-7">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(242,185,28,0.22),transparent_40%)]"
        />
        <div className="relative max-w-3xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-gold">
            <Crown className="h-4 w-4" /> Assinatura mensal
          </p>
          <h2 className="mt-3 text-2xl font-semibold">
            Mais beneficios para viver o Bolao do Lobo
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/70">
            Pague por Pix ou use cartao com renovacao automatica pelo checkout seguro do Mercado
            Pago. Nenhum dado do cartao passa pelo Bolao.
          </p>
        </div>
      </section>
      <PlansCheckout
        current={
          data.current
            ? {
                ...data.current,
                currentPeriodEnd: data.current.currentPeriodEnd?.toISOString() ?? null
              }
            : null
        }
      />
    </PageShell>
  );
}
