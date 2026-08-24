"use client";

import { ArrowLeft, CreditCard, LogIn, WalletCards } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonVariants } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { ActionAlert } from "@/features/auth/components/action-alert";
import { PixPaymentCard } from "@/features/payments/components/pix-payment-card";
import { joinAvailableLeagueAction, joinLeagueWithWalletAction } from "../actions/league-actions";
import type { LeaguePaymentIntent } from "../types/league-action-result";

type LeaguePaymentDisplayIntent = Pick<
  LeaguePaymentIntent,
  "amountLabel" | "leagueName" | "paymentId" | "pixCode" | "qrCodeDataUri" | "transactionId"
> &
  Partial<LeaguePaymentIntent>;

type JoinAvailableLeagueButtonProps = {
  initialPaymentIntent?: LeaguePaymentDisplayIntent;
  leagueId: string;
  requiresPayment: boolean;
};

export function JoinAvailableLeagueButton({
  initialPaymentIntent,
  leagueId,
  requiresPayment
}: JoinAvailableLeagueButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [paymentIntent, setPaymentIntent] = useState<LeaguePaymentDisplayIntent | undefined>(
    initialPaymentIntent
  );

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

  function onWalletJoin() {
    setMessage(undefined);
    setError(undefined);
    startTransition(() => {
      void joinLeagueWithWalletAction({ leagueId }).then((result) => {
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setMessage(result.message);
        setPaymentIntent(undefined);
        router.refresh();
      });
    });
  }

  function returnToPaymentOptions() {
    setPaymentIntent(undefined);
    setMessage(undefined);
    setError(undefined);
  }

  return (
    <div className="space-y-3">
      {!paymentIntent ? (
        <LoadingButton
          className={buttonVariants({
            size: "sm",
            variant: requiresPayment ? "primary" : "accent"
          })}
          disabled={isPending}
          icon={
            requiresPayment ? (
              <CreditCard aria-hidden className="h-4 w-4" />
            ) : (
              <LogIn aria-hidden className="h-4 w-4" />
            )
          }
          isLoading={isPending}
          loadingLabel={requiresPayment ? "Processando..." : "Entrando..."}
          onClick={onJoin}
          type="button"
        >
          {requiresPayment ? "Pagar e entrar" : "Entrar"}
        </LoadingButton>
      ) : null}
      {requiresPayment && !paymentIntent ? (
        <LoadingButton
          className={buttonVariants({ size: "sm", variant: "secondary" })}
          disabled={isPending}
          icon={<WalletCards aria-hidden className="h-4 w-4" />}
          isLoading={isPending}
          loadingLabel="Processando..."
          onClick={onWalletJoin}
          type="button"
        >
          Usar saldo ou vale
        </LoadingButton>
      ) : null}
      <ActionAlert message={message} tone="success" />
      <ActionAlert message={error} />
      {error?.includes("Saldo insuficiente") ? (
        <Link className="text-sm font-medium text-brand-gold underline" href={"/carteira" as Route}>
          Adicionar saldo
        </Link>
      ) : null}
      {paymentIntent ? (
        <>
          <button
            className={buttonVariants({ size: "sm", variant: "secondary" })}
            onClick={returnToPaymentOptions}
            type="button"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Voltar e escolher saldo ou vale
          </button>
          <PixPaymentCard {...paymentIntent} />
        </>
      ) : null}
    </div>
  );
}
