import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";

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

          <div className="rounded-card border border-app-border bg-app-surface p-5 shadow-soft">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-app-border pb-4">
                <div>
                  <p className="text-sm font-semibold text-app-foreground">Rodada atual</p>
                  <p className="text-sm text-app-muted">Acompanhe seus palpites</p>
                </div>
                <span className="rounded-full bg-brand-green px-2.5 py-1 text-xs font-semibold text-white">
                  Aberta
                </span>
              </div>
              <div className="grid gap-3">
                <div className="rounded-control bg-app-elevated p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-app-muted">
                    Proximo jogo
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold text-app-foreground">
                    <span>Casa</span>
                    <span className="rounded-full bg-brand-gold px-2 py-1 text-xs text-slate-950">
                      vs
                    </span>
                    <span>Visitante</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-control bg-app-elevated p-3">
                    <p className="text-xs text-app-muted">Pontos</p>
                    <p className="mt-1 text-xl font-bold text-app-foreground">0</p>
                  </div>
                  <div className="rounded-control bg-app-elevated p-3">
                    <p className="text-xs text-app-muted">Ranking</p>
                    <p className="mt-1 text-xl font-bold text-app-foreground">--</p>
                  </div>
                  <div className="rounded-control bg-app-elevated p-3">
                    <p className="text-xs text-app-muted">XP</p>
                    <p className="mt-1 text-xl font-bold text-app-foreground">0</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
