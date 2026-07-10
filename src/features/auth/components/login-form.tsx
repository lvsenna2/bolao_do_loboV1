"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { getSession, signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { loginSchema, type LoginInput } from "../schemas/auth-schemas";
import { ActionAlert } from "./action-alert";
import { AuthField } from "./auth-field";

type LoginFormProps = {
  callbackUrl?: string;
  registered?: boolean;
};

const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);
const defaultCallbackUrl = "/dashboard";

export function LoginForm({ callbackUrl, registered = false }: LoginFormProps) {
  const [message, setMessage] = useState<string | undefined>(
    registered ? "Conta criada com sucesso. Entre para continuar." : undefined
  );
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    formState: { errors },
    handleSubmit,
    register
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  async function onSubmit(values: LoginInput) {
    setIsSubmitting(true);
    setError(undefined);
    setMessage(undefined);

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
      callbackUrl: callbackUrl ?? defaultCallbackUrl
    });

    setIsSubmitting(false);

    if (!result || result.error) {
      setError("E-mail ou senha invalidos.");
      return;
    }

    if (callbackUrl) {
      window.location.assign(result.url ?? callbackUrl);
      return;
    }

    const session = await getSession();
    const role = session?.user?.role;

    window.location.assign(adminRoles.has(String(role)) ? "/admin" : defaultCallbackUrl);
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
      <AuthField
        autoComplete="current-password"
        error={errors.password?.message}
        id="password"
        label="Senha"
        type="password"
        {...register("password")}
      />
      <button
        aria-busy={isSubmitting}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
        {isSubmitting ? "Entrando..." : "Entrar"}
        {!isSubmitting ? <ArrowRight aria-hidden className="h-4 w-4" /> : null}
      </button>
    </form>
  );
}
