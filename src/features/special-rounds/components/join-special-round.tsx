"use client";

import { useEffect, useState, useTransition } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import { PixPaymentCard } from "@/features/payments/components/pix-payment-card";
import { joinSpecialRoundAction } from "../actions/special-round-actions";

export type SpecialRoundPaymentView = {
  amountLabel: string;
  expiresAtLabel?: string;
  paymentId: string;
  pixCode: string;
  qrCodeDataUri: string;
  ticketUrl?: string | null;
  transactionId: string;
};

export function JoinSpecialRound({
  initialPayment,
  name,
  specialRoundId
}: {
  initialPayment?: SpecialRoundPaymentView | null;
  name: string;
  specialRoundId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [payment, setPayment] = useState<SpecialRoundPaymentView | null>(initialPayment ?? null);

  useEffect(() => {
    if (initialPayment) setPayment(initialPayment);
  }, [initialPayment]);

  function join() {
    startTransition(async () => {
      const result = await joinSpecialRoundAction(specialRoundId);
      setMessage(result.message);
      if (result.ok && result.data?.paymentId) {
        setPayment(result.data as SpecialRoundPaymentView);
      }
    });
  }

  return (
    <div className="space-y-4">
      {!payment ? (
        <LoadingButton
          className="h-12 w-full rounded-button bg-brand-gold px-5 font-semibold text-black hover:bg-amber-300"
          isLoading={pending}
          loadingLabel="Gerando inscricao..."
          onClick={join}
        >
          Participar
        </LoadingButton>
      ) : null}
      {message ? (
        <p aria-live="polite" className="text-sm text-app-muted">
          {message}
        </p>
      ) : null}
      {payment ? <PixPaymentCard {...payment} leagueName={name} variant="special-round" /> : null}
    </div>
  );
}
