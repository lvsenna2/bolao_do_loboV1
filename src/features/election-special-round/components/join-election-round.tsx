"use client";

import { useEffect, useState, useTransition } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import { PixPaymentCard } from "@/features/payments/components/pix-payment-card";
import { joinElectionRoundAction } from "../actions";
import type { ElectionPaymentView } from "../types";

export function JoinElectionRound({
  initialPayment,
  name,
  roundId
}: {
  initialPayment?: ElectionPaymentView | null;
  name: string;
  roundId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [payment, setPayment] = useState<ElectionPaymentView | null>(initialPayment ?? null);

  useEffect(() => {
    if (initialPayment) setPayment(initialPayment);
  }, [initialPayment]);

  function join() {
    startTransition(async () => {
      const result = await joinElectionRoundAction(roundId);
      setMessage(result.message);
      if (result.ok && result.data?.paymentId) setPayment(result.data);
    });
  }

  return (
    <div className="space-y-4">
      {!payment ? (
        <LoadingButton
          className="h-12 w-full rounded-button bg-brand-gold px-5 font-semibold text-black"
          isLoading={pending}
          loadingLabel="Gerando inscrição..."
          onClick={join}
        >
          Participar por R$ 10,00
        </LoadingButton>
      ) : null}
      {message ? (
        <p aria-live="polite" className="text-sm text-app-muted">
          {message}
        </p>
      ) : null}
      {payment ? <PixPaymentCard {...payment} leagueName={name} variant="election" /> : null}
    </div>
  );
}
