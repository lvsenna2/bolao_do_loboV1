"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { LoadingButton } from "@/components/ui/loading-button";
import { ActionAlert } from "@/features/auth/components/action-alert";
import { AuthField } from "@/features/auth/components/auth-field";
import { applyServerFieldErrors } from "@/features/auth/components/form-error-utils";
import { updatePasswordAction } from "../actions/user-actions";
import { updatePasswordSchema, type UpdatePasswordInput } from "../schemas/user-schemas";

export function PasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | undefined>();
  const [error, setErrorMessage] = useState<string | undefined>();
  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      confirmPassword: "",
      currentPassword: "",
      password: ""
    }
  });

  function onSubmit(values: UpdatePasswordInput) {
    setMessage(undefined);
    setErrorMessage(undefined);

    startTransition(() => {
      void updatePasswordAction(values).then((result) => {
        if (!result.ok) {
          setErrorMessage(result.message);
          applyServerFieldErrors(setError, result.fieldErrors);
          return;
        }

        reset();
        setMessage(result.message);
      });
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <ActionAlert message={message} tone="success" />
      <ActionAlert message={error} />
      <AuthField
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        id="currentPassword"
        label="Senha atual"
        type="password"
        {...register("currentPassword")}
      />
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
        className="inline-flex h-10 items-center justify-center gap-2 rounded-button bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
        icon={<KeyRound aria-hidden className="h-4 w-4" />}
        isLoading={isPending}
        loadingLabel="Salvando..."
        type="submit"
      >
        Atualizar senha
      </LoadingButton>
    </form>
  );
}
