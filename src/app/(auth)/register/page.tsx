import Link from "next/link";
import type { Route } from "next";

import { AuthCard } from "@/features/auth/components/auth-card";
import { RegisterForm } from "@/features/auth/components/register-form";
import { getSafeCallbackUrl } from "@/features/auth/utils/login-destination";

type RegisterPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const callbackUrl = getSafeCallbackUrl(params.callbackUrl);
  const loginHref = callbackUrl
    ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/login";

  return (
    <AuthCard
      description="Crie sua conta para participar dos boloes."
      footer={
        <p className="text-sm text-app-muted">
          Ja tem conta?{" "}
          <Link className="font-medium text-brand-gold hover:text-amber-300" href={loginHref as Route}>
            Entrar
          </Link>
        </p>
      }
      title="Criar conta"
    >
      <RegisterForm callbackUrl={callbackUrl} />
    </AuthCard>
  );
}
