import Link from "next/link";
import type { Route } from "next";

import { AuthCard } from "@/features/auth/components/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";
import { PasskeyLoginButton } from "@/features/auth/components/passkey-login-button";
import { getSafeCallbackUrl } from "@/features/auth/utils/login-destination";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
    registered?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackUrl = getSafeCallbackUrl(params.callbackUrl);
  // Quem chega por um link de campanha precisa voltar para a promocao depois de se cadastrar,
  // com os parametros de UTM intactos.
  const registerHref = callbackUrl
    ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/register";

  return (
    <AuthCard
      description="Entre com seu e-mail e senha para acessar sua conta."
      footer={
        <div className="flex flex-col gap-3 text-sm text-app-muted">
          <Link
            className="font-medium text-brand-gold hover:text-amber-300"
            href={registerHref as Route}
          >
            Criar conta
          </Link>
          <Link
            className="font-medium text-app-foreground hover:text-brand-gold"
            href="/forgot-password"
          >
            Esqueci minha senha
          </Link>
        </div>
      }
      title="Entrar no bolao"
    >
      <LoginForm callbackUrl={callbackUrl} registered={params.registered === "1"} />
      <PasskeyLoginButton callbackUrl={callbackUrl} />
    </AuthCard>
  );
}
