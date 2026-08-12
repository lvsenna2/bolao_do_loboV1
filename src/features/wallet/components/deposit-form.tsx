"use client";

import { useState } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import { PixPaymentCard } from "@/features/payments/components/pix-payment-card";
import { createWalletDepositAction } from "../actions/wallet-actions";

type DepositResult = Awaited<ReturnType<typeof createWalletDepositAction>>;
type PaymentData = NonNullable<Extract<DepositResult, { ok: true }>["data"]>;

export function DepositForm() {
  const [amount, setAmount] = useState(1_000);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState<PaymentData>();

  async function createDeposit() {
    if (loading) return;
    setLoading(true);
    setError(undefined);
    try {
      const result = await createWalletDepositAction(amount);
      if (!result.ok) setError(result.message);
      else setPayment(result.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[1_000, 2_000, 5_000, 10_000].map((value) => (
          <button
            className={`h-10 rounded-button border px-4 text-sm font-semibold ${amount === value ? "border-brand-gold bg-brand-gold text-black" : "border-app-border bg-app-background text-app-foreground"}`}
            key={value}
            onClick={() => setAmount(value)}
            type="button"
          >
            R$ {value / 100}
          </button>
        ))}
        <LoadingButton
          className="h-10 rounded-button bg-brand-gold px-5 font-semibold text-black"
          isLoading={loading}
          loadingLabel="Gerando Pix..."
          onClick={createDeposit}
        >
          Adicionar saldo
        </LoadingButton>
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {payment ? (
        <PixPaymentCard
          amountLabel={payment.amountLabel}
          leagueName="Adicionar saldo"
          paymentId={payment.paymentId}
          pixCode={payment.pixCode}
          qrCodeDataUri={payment.qrCodeDataUri}
          ticketUrl={payment.ticketUrl}
          transactionId={payment.transactionId}
          variant="wallet"
        />
      ) : null}
    </div>
  );
}
