import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      description="Informe o e-mail da conta para iniciar a recuperacao."
      footer={
        <Link className="text-sm font-medium text-brand-gold hover:text-amber-300" href="/login">
          Voltar para login
        </Link>
      }
      title="Recuperar senha"
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
