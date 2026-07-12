"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { LoadingButton } from "@/components/ui/loading-button";
import { resetPasswordAction } from "../actions/auth-actions";
import { resetPasswordSchema, type ResetPasswordInput } from "../schemas/auth-schemas";
import { ActionAlert } from "./action-alert";
import { AuthField } from "./auth-field";
import { applyServerFieldErrors } from "./form-error-utils";

type ResetPasswordFormProps = {
  token: string;
};

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | undefined>();
  const [error, setErrorMessage] = useState<string | undefined>();
  const {
    formState: { errors },
    handleSubmit,
    register,
    setError
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token,
      password: "",
      confirmPassword: ""
    }
  });

  function onSubmit(values: ResetPasswordInput) {
    setMessage(undefined);
    setErrorMessage(undefined);

    startTransition(() => {
      void resetPasswordAction(values).then((result) => {
        if (!result.ok) {
          setErrorMessage(result.message);
          applyServerFieldErrors(setError, result.fieldErrors);
          return;
        }

        setMessage(result.message);
        router.push("/login");
      });
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <ActionAlert message={message} tone="success" />
      <ActionAlert message={error} />
      <input type="hidden" {...register("token")} />
      <AuthField
        autoComplete="new-password"
        error={errors.password?.message}
        id="password"
        label="Nova senha"
        type="password"
        {...register("password")}
      />
      <AuthField
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        id="confirmPassword"
        label="Confirmar nova senha"
        type="password"
        {...register("confirmPassword")}
      />
      <LoadingButton
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
        icon={<ArrowRight aria-hidden className="h-4 w-4" />}
        isLoading={isPending}
        loadingLabel="Salvando..."
        type="submit"
      >
        Atualizar senha
      </LoadingButton>
    </form>
  );
}
