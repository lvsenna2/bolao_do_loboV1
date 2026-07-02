import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-app-background text-app-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:px-8">
        <section className="hidden space-y-6 lg:block">
          <div className="flex items-center justify-between">
            <BrandLogo />
            <ThemeToggle />
          </div>
          <div className="max-w-xl space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-gold">
              Acesso seguro
            </p>
            <h1 className="text-4xl font-bold text-app-foreground">Bolao do Lobo</h1>
            <p className="text-base leading-7 text-app-muted">
              Entre para acompanhar rodadas, registrar palpites e consultar rankings.
            </p>
          </div>
        </section>
        <div className="space-y-5">
          <div className="flex items-center justify-between lg:hidden">
            <BrandLogo />
            <ThemeToggle />
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
