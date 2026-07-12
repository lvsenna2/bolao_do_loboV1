"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { LoadingButton } from "@/components/ui/loading-button";
import { requestPasswordResetAction } from "../actions/auth-actions";
import { forgotPasswordSchema, type ForgotPasswordInput } from "../schemas/auth-schemas";
import { ActionAlert } from "./action-alert";
import { AuthField } from "./auth-field";
import { applyServerFieldErrors } from "./form-error-utils";

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | undefined>();
  const [error, setErrorMessage] = useState<string | undefined>();
  const {
    formState: { errors },
    handleSubmit,
    register,
    setError
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: ""
    }
  });

  function onSubmit(values: ForgotPasswordInput) {
    setMessage(undefined);
    setErrorMessage(undefined);

    startTransition(() => {
      void requestPasswordResetAction(values).then((result) => {
        if (!result.ok) {
          setErrorMessage(result.message);
          applyServerFieldErrors(setError, result.fieldErrors);
          return;
        }

        setMessage(result.message);
      });
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <ActionAlert message={message} tone="success" />
      <ActionAlert message={error} />
      <AuthField
        autoComplete="email"
        error={errors.email?.message}
        id="email"
        label="E-mail"
        type="email"
        {...register("email")}
      />
      <LoadingButton
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
        icon={<Mail aria-hidden className="h-4 w-4" />}
        isLoading={isPending}
        loadingLabel="Enviando..."
        type="submit"
      >
        Enviar instrucoes
      </LoadingButton>
    </form>
  );
}
