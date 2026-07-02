import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { RegisterForm } from "@/features/auth/components/register-form";

export default function RegisterPage() {
  return (
    <AuthCard
      description="Crie sua conta para participar dos boloes."
      footer={
        <p className="text-sm text-app-muted">
          Ja tem conta?{" "}
          <Link className="font-medium text-brand-gold hover:text-amber-300" href="/login">
            Entrar
          </Link>
        </p>
      }
      title="Criar conta"
    >
      <RegisterForm />
    </AuthCard>
  );
}
