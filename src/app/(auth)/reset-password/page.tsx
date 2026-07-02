import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;

  return (
    <AuthCard
      description="Defina uma nova senha para continuar."
      footer={
        <Link className="text-sm font-medium text-brand-gold hover:text-amber-300" href="/login">
          Voltar para login
        </Link>
      }
      title="Nova senha"
    >
      {params.token ? (
        <ResetPasswordForm token={params.token} />
      ) : (
        <p className="rounded-control border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
          Link de recuperacao invalido.
        </p>
      )}
    </AuthCard>
  );
}
