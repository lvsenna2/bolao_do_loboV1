"use client";

import { Check, HandCoins, HeartHandshake } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import { PixPaymentCard } from "@/features/payments/components/pix-payment-card";
import { cn } from "@/lib/utils";
import { createApiFundingContributionAction } from "../actions";
import { API_FUNDING_AMOUNTS } from "../schemas";
import type { ApiFundingPaymentView } from "../types";

export function ApiFundingCheckout({
  initialPayment
}: {
  initialPayment: ApiFundingPaymentView | null;
}) {
  const [amount, setAmount] = useState<(typeof API_FUNDING_AMOUNTS)[number]>(10);
  const [message, setMessage] = useState("");
  const [payment, setPayment] = useState(initialPayment);
  const [pending, startTransition] = useTransition();
  const idempotencyKey = useRef<string | null>(null);

  function createContribution() {
    if (pending || payment) return;
    idempotencyKey.current ??= window.crypto.randomUUID();

    startTransition(async () => {
      const result = await createApiFundingContributionAction({
        amount,
        idempotencyKey: idempotencyKey.current
      });
      setMessage(result.message);
      if (result.ok && result.data) setPayment(result.data);
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-card border border-brand-gold/35 bg-app-surface p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-brand-gold text-black">
            <HeartHandshake aria-hidden className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Escolha sua contribuicao</h2>
            <p className="mt-1 text-sm leading-6 text-app-muted">
              Cada apoio ajuda a manter os dados esportivos atualizados. A contribuicao nao altera
              pontos, XP ou resultados do bolao.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {API_FUNDING_AMOUNTS.map((option) => {
            const selected = amount === option;
            return (
              <button
                aria-pressed={selected}
                className={cn(
                  "relative flex h-20 flex-col items-center justify-center rounded-control border text-center transition",
                  selected
                    ? "border-brand-gold bg-brand-gold/15 text-brand-gold shadow-[0_0_0_1px_rgba(242,185,28,0.2)]"
                    : "border-app-border bg-app-background text-app-foreground hover:border-brand-gold/60"
                )}
                disabled={Boolean(payment) || pending}
                key={option}
                onClick={() => setAmount(option)}
                type="button"
              >
                {selected ? <Check className="absolute right-2 top-2 h-4 w-4" /> : null}
                <span className="text-xs uppercase text-app-muted">Contribuir</span>
                <strong className="mt-1 text-xl">R$ {option}</strong>
              </button>
            );
          })}
        </div>

        <LoadingButton
          className="mt-4 h-12 w-full rounded-button bg-brand-gold px-5 font-semibold text-black hover:bg-amber-400"
          disabled={Boolean(payment)}
          icon={<HandCoins className="h-5 w-5" />}
          isLoading={pending}
          loadingLabel="Gerando PIX..."
          onClick={createContribution}
          type="button"
        >
          {payment ? "Finalize o PIX abaixo" : `Contribuir com R$ ${amount}`}
        </LoadingButton>

        {message ? (
          <p aria-live="polite" className="mt-3 text-center text-sm text-app-muted">
            {message}
          </p>
        ) : null}
      </section>

      {payment ? (
        <PixPaymentCard
          amountLabel={payment.amountLabel}
          expiresAtLabel={payment.expiresAtLabel}
          leagueName="Apoio a API do Bolao do Lobo"
          onApproved={() => {
            setPayment(null);
            setMessage("Contribuicao confirmada. Muito obrigado pelo apoio!");
            idempotencyKey.current = null;
          }}
          paymentId={payment.paymentId}
          pixCode={payment.pixCode}
          qrCodeDataUri={payment.qrCodeDataUri}
          ticketUrl={payment.ticketUrl}
          transactionId={payment.transactionId}
          variant="api-funding"
        />
      ) : null}
    </div>
  );
}
