"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { getSession, signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { LoadingButton } from "@/components/ui/loading-button";
import { loginSchema, type LoginInput } from "../schemas/auth-schemas";
import { ActionAlert } from "./action-alert";
import { AuthField } from "./auth-field";

type LoginFormProps = {
  callbackUrl?: string;
  registered?: boolean;
};

const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);
const defaultCallbackUrl = "/dashboard";

async function getSessionWithTimeout() {
  return Promise.race([
    getSession(),
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), 2500);
    })
  ]);
}

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

    try {
      const result = await signIn("credentials", {
        callbackUrl: callbackUrl ?? defaultCallbackUrl,
        email: values.email,
        password: values.password,
        redirect: false
      });

      if (!result || result.error) {
        setError("E-mail ou senha invalidos.");
        return;
      }

      if (callbackUrl) {
        window.location.assign(result.url ?? callbackUrl);
        return;
      }

      const session = await getSessionWithTimeout();
      const role = session?.user?.role;
      const destination = adminRoles.has(String(role)) ? "/admin" : defaultCallbackUrl;

      window.location.assign(destination);
    } catch {
      setError("Nao foi possivel entrar agora. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
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
      <LoadingButton
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isSubmitting}
        icon={<ArrowRight aria-hidden className="h-4 w-4" />}
        isLoading={isSubmitting}
        loadingLabel="Entrando..."
        type="submit"
      >
        Entrar
      </LoadingButton>
    </form>
  );
}
