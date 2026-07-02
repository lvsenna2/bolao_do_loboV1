"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { AuthField } from "@/features/auth/components/auth-field";
import { ActionAlert } from "@/features/auth/components/action-alert";
import { applyServerFieldErrors } from "@/features/auth/components/form-error-utils";
import { updateProfileAction } from "../actions/user-actions";
import { updateProfileSchema, type UpdateProfileInput } from "../schemas/user-schemas";

type ProfileFormProps = {
  defaultValues: UpdateProfileInput;
};

export function ProfileForm({ defaultValues }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | undefined>();
  const [error, setErrorMessage] = useState<string | undefined>();
  const {
    formState: { errors },
    handleSubmit,
    register,
    setError
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues
  });

  function onSubmit(values: UpdateProfileInput) {
    setMessage(undefined);
    setErrorMessage(undefined);

    startTransition(() => {
      void updateProfileAction(values).then((result) => {
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
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
      <div className="md:col-span-2">
        <ActionAlert message={message} tone="success" />
        <ActionAlert message={error} />
      </div>
      <AuthField
        error={errors.firstName?.message}
        id="firstName"
        label="Nome"
        {...register("firstName")}
      />
      <AuthField
        error={errors.lastName?.message}
        id="lastName"
        label="Sobrenome"
        {...register("lastName")}
      />
      <AuthField
        error={errors.username?.message}
        id="username"
        label="Username"
        {...register("username")}
      />
      <AuthField
        error={errors.avatarUrl?.message}
        id="avatarUrl"
        label="URL da foto"
        type="url"
        {...register("avatarUrl")}
      />
      <label className="space-y-2">
        <span className="text-sm font-medium text-app-foreground">Idioma</span>
        <select
          className="h-11 w-full rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
          {...register("locale")}
        >
          <option value="pt-BR">pt-BR</option>
          <option value="en-US">en-US</option>
          <option value="es-ES">es-ES</option>
        </select>
      </label>
      <label className="space-y-2">
        <span className="text-sm font-medium text-app-foreground">Tema</span>
        <select
          className="h-11 w-full rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
          {...register("theme")}
        >
          <option value="system">Sistema</option>
          <option value="light">Claro</option>
          <option value="dark">Escuro</option>
        </select>
      </label>
      <div className="md:col-span-2">
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-button bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isPending}
          type="submit"
        >
          {isPending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
          Salvar perfil
          {!isPending ? <Save aria-hidden className="h-4 w-4" /> : null}
        </button>
      </div>
    </form>
  );
}
