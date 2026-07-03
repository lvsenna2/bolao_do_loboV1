"use client";

import { LogIn, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ActionAlert } from "@/features/auth/components/action-alert";
import { buttonVariants } from "@/components/ui/button";
import { joinPublicLeagueAction } from "../actions/league-actions";

type JoinPublicLeagueButtonProps = {
  leagueId: string;
};

export function JoinPublicLeagueButton({ leagueId }: JoinPublicLeagueButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  function onJoin() {
    setMessage(undefined);
    setError(undefined);

    startTransition(() => {
      void joinPublicLeagueAction({ leagueId }).then((result) => {
        if (!result.ok) {
          setError(result.message);
          return;
        }

        setMessage(result.message);
        router.refresh();
      });
    });
  }

  return (
    <div className="space-y-2">
      <button
        className={buttonVariants({ size: "sm", variant: "accent" })}
        disabled={isPending}
        onClick={onJoin}
        type="button"
      >
        {isPending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
        Entrar
        {!isPending ? <LogIn aria-hidden className="h-4 w-4" /> : null}
      </button>
      <ActionAlert message={message} tone="success" />
      <ActionAlert message={error} />
    </div>
  );
}
