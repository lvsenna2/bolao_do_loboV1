"use client";

import type {
  SubscriptionPaymentMethod,
  SubscriptionPlan,
  SubscriptionStatus
} from "@prisma/client";
import { Check, CreditCard, Gem, Medal, QrCode, ShieldCheck, Sparkles } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import { PixPaymentCard } from "@/features/payments/components/pix-payment-card";
import { cn } from "@/lib/utils";
import { cancelSubscriptionAction, startSubscriptionAction } from "../actions";
import { getPlanConfig, SUBSCRIPTION_PLAN_ORDER } from "../config";
import type { SubscriptionPixView } from "../types";

type CurrentSubscriptionView = {
  amount: number;
  checkoutUrl: string | null;
  currentPeriodEnd: string | null;
  currentPeriodEndLabel: string | null;
  hasBenefits: boolean;
  id: string;
  paymentMethod: SubscriptionPaymentMethod;
  pendingPayment: SubscriptionPixView | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
} | null;

const statusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: "Ativa",
  CANCELED: "Cancelada",
  EXPIRED: "Expirada",
  PAST_DUE: "Pagamento atrasado",
  PENDING: "Aguardando pagamento",
  REFUNDED: "Estornada"
};

const planIcons = { PLATINUM: Gem, OURO: Sparkles, PRATA: Medal } as const;

export function PlansCheckout({ current }: { current: CurrentSubscriptionView }) {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(current?.plan ?? "PLATINUM");
  const [paymentMethod, setPaymentMethod] = useState<SubscriptionPaymentMethod>(
    current?.paymentMethod ?? "CARD"
  );
  const [payment, setPayment] = useState<SubscriptionPixView | null>(
    current?.pendingPayment ?? null
  );
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const idempotencyKey = useRef<string | null>(null);

  function subscribe() {
    if (pending) return;
    idempotencyKey.current ??= window.crypto.randomUUID();
    startTransition(async () => {
      const result = await startSubscriptionAction({
        idempotencyKey: idempotencyKey.current,
        paymentMethod,
        plan: selectedPlan
      });
      setMessage(result.message);
      if (!result.ok || !result.data) return;
      if (result.data.payment) setPayment(result.data.payment);
      if (result.data.checkoutUrl) window.location.assign(result.data.checkoutUrl);
    });
  }

  function cancel() {
    if (!current || pending) return;
    startTransition(async () => {
      const result = await cancelSubscriptionAction(current.id);
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      {current ? (
        <section className="rounded-card border border-brand-gold/35 bg-[#11100d] p-5 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-gold">
                Minha assinatura
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Plano {getPlanConfig(current.plan).name}
              </h2>
              <p className="mt-2 text-sm text-white/65">
                {statusLabels[current.status]} |{" "}
                {current.paymentMethod === "CARD" ? "Cartao recorrente" : "Pix mensal"}
              </p>
              {current.currentPeriodEnd ? (
                <p className="mt-1 text-sm text-white/65">
                  Beneficios ate {current.currentPeriodEndLabel}
                </p>
              ) : null}
            </div>
            {current.status === "PENDING" && current.checkoutUrl ? (
              <a
                className="inline-flex h-11 items-center justify-center rounded-button bg-brand-gold px-5 font-semibold text-black"
                href={current.checkoutUrl}
              >
                Continuar no Mercado Pago
              </a>
            ) : ["ACTIVE", "PENDING", "PAST_DUE"].includes(current.status) ? (
              <LoadingButton
                className="h-11 rounded-button border border-red-400/45 px-5 text-red-200"
                isLoading={pending}
                loadingLabel="Cancelando..."
                onClick={cancel}
                type="button"
              >
                Cancelar renovacao
              </LoadingButton>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        {SUBSCRIPTION_PLAN_ORDER.map((plan) => {
          const config = getPlanConfig(plan);
          const Icon = planIcons[plan];
          const selected = selectedPlan === plan;
          return (
            <button
              aria-pressed={selected}
              className={cn(
                "relative flex min-h-[310px] flex-col rounded-card border p-5 text-left transition",
                plan === "PLATINUM"
                  ? "border-brand-gold bg-[radial-gradient(circle_at_top_right,rgba(242,185,28,0.2),transparent_45%),#11100d] text-white shadow-[0_24px_70px_-38px_rgba(242,185,28,0.55)]"
                  : "border-app-border bg-app-surface",
                selected && "ring-2 ring-brand-gold ring-offset-2 ring-offset-app-background"
              )}
              key={plan}
              onClick={() => {
                setSelectedPlan(plan);
                setPayment(null);
                idempotencyKey.current = null;
              }}
              type="button"
            >
              {plan === "PLATINUM" ? (
                <span className="absolute right-4 top-4 rounded-full bg-brand-gold px-3 py-1 text-xs font-semibold text-black">
                  Mais completo
                </span>
              ) : null}
              <Icon className="h-8 w-8 text-brand-gold" />
              <h2 className="mt-4 text-2xl font-semibold">{config.name}</h2>
              <p className="mt-2 text-3xl font-semibold text-brand-gold">
                {config.price.toLocaleString("pt-BR", { currency: "BRL", style: "currency" })}
                <span className="text-sm font-normal text-app-muted">/mes</span>
              </p>
              <p className="mt-2 text-sm text-app-muted">{config.description}</p>
              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex gap-2">
                  <Check className="h-4 w-4 shrink-0 text-brand-gold" />{" "}
                  {config.benefits.discountPercent}% de desconto nas ligas
                </li>
                {config.benefits.freeLeagues ? (
                  <li className="flex gap-2">
                    <Check className="h-4 w-4 shrink-0 text-brand-gold" /> Todas as ligas gratuitas
                  </li>
                ) : null}
                {config.benefits.canCreateSpecialRound ? (
                  <li className="flex gap-2">
                    <Check className="h-4 w-4 shrink-0 text-brand-gold" /> Criar e escolher Rodadas
                    Especiais
                  </li>
                ) : null}
                <li className="flex gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-brand-gold" /> Emblema exclusivo{" "}
                  {config.benefits.badge}
                </li>
              </ul>
            </button>
          );
        })}
      </section>

      <section className="rounded-card border border-app-border bg-app-surface p-5">
        <h2 className="text-lg font-semibold">Forma de pagamento</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            aria-pressed={paymentMethod === "CARD"}
            className={cn(
              "flex min-h-20 items-center gap-3 rounded-control border p-4 text-left",
              paymentMethod === "CARD" ? "border-brand-gold bg-brand-gold/10" : "border-app-border"
            )}
            onClick={() => {
              setPaymentMethod("CARD");
              setPayment(null);
              idempotencyKey.current = null;
            }}
            type="button"
          >
            <CreditCard className="h-6 w-6 text-brand-gold" />
            <span>
              <strong className="block">Cartao de credito</strong>
              <small className="text-app-muted">
                Renovacao mensal automatica no checkout seguro
              </small>
            </span>
          </button>
          <button
            aria-pressed={paymentMethod === "PIX"}
            className={cn(
              "flex min-h-20 items-center gap-3 rounded-control border p-4 text-left",
              paymentMethod === "PIX" ? "border-brand-gold bg-brand-gold/10" : "border-app-border"
            )}
            onClick={() => {
              setPaymentMethod("PIX");
              setPayment(null);
              idempotencyKey.current = null;
            }}
            type="button"
          >
            <QrCode className="h-6 w-6 text-brand-gold" />
            <span>
              <strong className="block">Pix</strong>
              <small className="text-app-muted">Pagamento mensal sem renovacao automatica</small>
            </span>
          </button>
        </div>
        <LoadingButton
          className="mt-4 h-12 w-full rounded-button bg-brand-gold px-5 font-semibold text-black hover:bg-amber-400"
          isLoading={pending}
          loadingLabel={paymentMethod === "CARD" ? "Abrindo checkout..." : "Gerando Pix..."}
          onClick={subscribe}
          type="button"
        >
          {current?.hasBenefits ? "Trocar plano" : `Assinar ${getPlanConfig(selectedPlan).name}`}
        </LoadingButton>
        {message ? (
          <p aria-live="polite" className="mt-3 text-center text-sm text-app-muted">
            {message}
          </p>
        ) : null}
      </section>

      {payment ? (
        <PixPaymentCard
          {...payment}
          leagueName={`Plano ${getPlanConfig(selectedPlan).name}`}
          onApproved={() => window.location.reload()}
          variant="subscription"
        />
      ) : null}
    </div>
  );
}
