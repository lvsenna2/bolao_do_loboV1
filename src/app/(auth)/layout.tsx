import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { WolfAuthScene } from "@/features/auth/components/wolf-auth-scene";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="auth-wolf-page relative min-h-[100svh] overflow-hidden bg-app-background text-app-foreground">
      <div className="auth-wolf-bg-layer" aria-hidden="true" />
      <div className="mx-auto grid min-h-[100svh] w-full max-w-7xl items-center gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:px-8">
        <section className="relative z-10 hidden min-h-[720px] flex-col justify-between py-4 lg:flex">
          <div className="flex items-center justify-between">
            <BrandLogo />
            <ThemeToggle />
          </div>
          <div className="auth-wolf-copy max-w-xl space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-gold">
              Acesso seguro
            </p>
            <h1 className="text-5xl font-black uppercase leading-none text-app-foreground">
              Bolao do Lobo
            </h1>
            <p className="max-w-lg text-base leading-7 text-app-muted">
              Monte seu palpite. Mostre que e lobo.
            </p>
          </div>
          <WolfAuthScene className="max-w-2xl" />
        </section>
        <div className="relative z-10 space-y-5">
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
