import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";

const benefits = [
  {
    description: "Registre seus placares em poucos passos, no celular ou no computador.",
    title: "Palpites rapidos"
  },
  {
    description: "Veja partidas e rodadas organizadas sem perder o contexto do campeonato.",
    title: "Rodadas organizadas"
  },
  {
    description: "Acompanhe sua pontuacao e a disputa com os outros participantes.",
    title: "Ranking atualizado"
  }
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-app-background text-app-foreground">
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center px-4 py-12 sm:px-6 lg:px-8">
        <section className="w-full">
          <div className="max-w-3xl space-y-6">
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

          <div className="mt-12 grid gap-3 sm:grid-cols-3" aria-label="Recursos da plataforma">
            {benefits.map((benefit) => (
              <article
                className="rounded-card border border-app-border bg-app-surface p-5"
                key={benefit.title}
              >
                <h2 className="text-base font-semibold text-app-foreground">{benefit.title}</h2>
                <p className="mt-2 text-sm leading-6 text-app-muted">{benefit.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
