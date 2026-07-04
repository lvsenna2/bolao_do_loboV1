"use client";

import { CreditCard, LogIn, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ActionAlert } from "@/features/auth/components/action-alert";
import { PixPaymentCard } from "@/features/payments/components/pix-payment-card";
import { joinAvailableLeagueAction } from "../actions/league-actions";
import type { LeaguePaymentIntent } from "../types/league-action-result";

type JoinAvailableLeagueButtonProps = {
  leagueId: string;
  requiresPayment: boolean;
};

export function JoinAvailableLeagueButton({
  leagueId,
  requiresPayment
}: JoinAvailableLeagueButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [paymentIntent, setPaymentIntent] = useState<LeaguePaymentIntent | undefined>();

  function onJoin() {
    setMessage(undefined);
    setError(undefined);
    setPaymentIntent(undefined);

    startTransition(() => {
      void joinAvailableLeagueAction({ leagueId }).then((result) => {
        if (!result.ok) {
          setError(result.message);
          return;
        }

        setMessage(result.message);
        setPaymentIntent(result.data);
        router.refresh();
      });
    });
  }

  return (
    <div className="space-y-3">
      <button
        className={buttonVariants({ size: "sm", variant: requiresPayment ? "primary" : "accent" })}
        disabled={isPending}
        onClick={onJoin}
        type="button"
      >
        {isPending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
        {requiresPayment ? "Pagar e entrar" : "Entrar"}
        {!isPending ? (
          requiresPayment ? (
            <CreditCard aria-hidden className="h-4 w-4" />
          ) : (
            <LogIn aria-hidden className="h-4 w-4" />
          )
        ) : null}
      </button>
      <ActionAlert message={message} tone="success" />
      <ActionAlert message={error} />
      {paymentIntent ? <PixPaymentCard {...paymentIntent} /> : null}
    </div>
  );
}
