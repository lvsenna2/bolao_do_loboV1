import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
    registered?: string;
  }>;
};

function getSafeCallbackUrl(callbackUrl?: string) {
  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return undefined;
  }

  return callbackUrl;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <AuthCard
      description="Entre com seu e-mail e senha para acessar seus boloes."
      footer={
        <div className="flex flex-col gap-3 text-sm text-app-muted">
          <Link className="font-medium text-brand-gold hover:text-amber-300" href="/register">
            Criar conta
          </Link>
          <Link
            className="font-medium text-app-foreground hover:text-brand-blue"
            href="/forgot-password"
          >
            Esqueci minha senha
          </Link>
        </div>
      }
      title="Entrar"
    >
      <LoginForm
        callbackUrl={getSafeCallbackUrl(params.callbackUrl)}
        registered={params.registered === "1"}
      />
    </AuthCard>
  );
}
