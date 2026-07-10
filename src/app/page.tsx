import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";
import { WolfAuthScene } from "@/features/auth/components/wolf-auth-scene";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-app-background text-app-foreground">
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="max-w-3xl space-y-6">
            <BrandLogo className="mb-2" />
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-gold">
              Palpites, rodadas e ranking
            </p>
            <h1 className="max-w-2xl text-4xl font-bold text-app-foreground sm:text-5xl">
              Bolao do Lobo
            </h1>
            <p className="max-w-2xl text-base leading-7 text-app-muted">
              Plataforma para organizar boloes esportivos, registrar palpites e acompanhar pontuacao
              com uma experiencia responsiva.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link className={buttonVariants({ size: "lg", variant: "accent" })} href="/login">
                Entrar
              </Link>
              <Link
                className={buttonVariants({ size: "lg", variant: "secondary" })}
                href="/register"
              >
                Criar conta
              </Link>
            </div>
          </div>

          <WolfAuthScene className="hidden min-h-[420px] lg:block" />
        </section>
      </main>
    </div>
  );
}
