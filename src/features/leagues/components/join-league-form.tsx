"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { ActionAlert } from "@/features/auth/components/action-alert";
import { AuthField } from "@/features/auth/components/auth-field";
import { applyServerFieldErrors } from "@/features/auth/components/form-error-utils";
import { joinLeagueAction } from "../actions/league-actions";
import { joinLeagueSchema, type JoinLeagueInput } from "../schemas/league-schemas";

type JoinLeagueFormProps = {
  defaultInviteCode?: string;
};

export function JoinLeagueForm({ defaultInviteCode = "" }: JoinLeagueFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | undefined>();
  const [error, setErrorMessage] = useState<string | undefined>();
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError
  } = useForm<JoinLeagueInput>({
    resolver: zodResolver(joinLeagueSchema),
    defaultValues: {
      inviteCode: defaultInviteCode
    }
  });

  function onSubmit(values: JoinLeagueInput) {
    setMessage(undefined);
    setErrorMessage(undefined);

    startTransition(() => {
      void joinLeagueAction(values).then((result) => {
        if (!result.ok) {
          setErrorMessage(result.message);
          applyServerFieldErrors(setError, result.fieldErrors);
          return;
        }

        setMessage(result.message);
        reset({
          inviteCode: defaultInviteCode
        });
        router.refresh();
      });
    });
  }

  return (
    <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={handleSubmit(onSubmit)}>
      <div className="sm:col-span-2">
        <ActionAlert message={message} tone="success" />
        <ActionAlert message={error} />
      </div>
      <AuthField
        error={errors.inviteCode?.message}
        id="inviteCode"
        label="Codigo da liga"
        placeholder={defaultInviteCode || "Ex: BRLOBO2026"}
        {...register("inviteCode")}
      />
      <div className="flex items-end">
        <button
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          disabled={isPending}
          type="submit"
        >
          {isPending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
          Entrar
          {!isPending ? <LogIn aria-hidden className="h-4 w-4" /> : null}
        </button>
      </div>
    </form>
  );
}
