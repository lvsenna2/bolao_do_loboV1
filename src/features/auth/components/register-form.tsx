"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { registerUserAction } from "../actions/auth-actions";
import { registerSchema, type RegisterInput } from "../schemas/auth-schemas";
import { ActionAlert } from "./action-alert";
import { AuthField } from "./auth-field";
import { applyServerFieldErrors } from "./form-error-utils";

export function RegisterForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | undefined>();
  const {
    formState: { errors },
    handleSubmit,
    register,
    setError
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      birthDate: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false
    }
  });

  function onSubmit(values: RegisterInput) {
    setFormError(undefined);

    startTransition(() => {
      void registerUserAction(values).then((result) => {
        if (!result.ok) {
          setFormError(result.message);
          applyServerFieldErrors(setError, result.fieldErrors);
          return;
        }

        router.push("/login?registered=1");
      });
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <ActionAlert message={formError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <AuthField
          autoComplete="given-name"
          error={errors.firstName?.message}
          id="firstName"
          label="Nome"
          {...register("firstName")}
        />
        <AuthField
          autoComplete="family-name"
          error={errors.lastName?.message}
          id="lastName"
          label="Sobrenome"
          {...register("lastName")}
        />
      </div>
      <AuthField
        autoComplete="username"
        error={errors.username?.message}
        id="username"
        label="Username"
        {...register("username")}
      />
      <AuthField
        autoComplete="email"
        error={errors.email?.message}
        id="email"
        label="E-mail"
        type="email"
        {...register("email")}
      />
      <AuthField
        error={errors.birthDate?.message}
        id="birthDate"
        label="Data de nascimento"
        type="date"
        {...register("birthDate")}
      />
      <AuthField
        autoComplete="new-password"
        error={errors.password?.message}
        id="password"
        label="Senha"
        type="password"
        {...register("password")}
      />
      <AuthField
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        id="confirmPassword"
        label="Confirmar senha"
        type="password"
        {...register("confirmPassword")}
      />
      <label className="flex items-start gap-3 rounded-control border border-app-border bg-app-background p-3 text-sm text-app-foreground">
        <input
          className="mt-1 h-4 w-4 rounded border-app-border bg-app-surface accent-brand-gold"
          type="checkbox"
          {...register("acceptTerms")}
        />
        <span>Li e aceito os termos de uso do Bolao do Lobo.</span>
      </label>
      {errors.acceptTerms?.message ? (
        <p className="text-sm text-red-600 dark:text-red-300">{errors.acceptTerms.message}</p>
      ) : null}
      <button
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
        type="submit"
      >
        {isPending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
        Criar conta
        {!isPending ? <ArrowRight aria-hidden className="h-4 w-4" /> : null}
      </button>
    </form>
  );
}
