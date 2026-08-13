import Image from "next/image";
import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-app-background text-app-foreground">
      <SiteHeader />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-16 h-[38rem] bg-[radial-gradient(circle_at_70%_42%,rgb(242_185_28_/_0.13),transparent_34%),radial-gradient(circle_at_24%_65%,rgb(242_185_28_/_0.05),transparent_30%)]"
      />
      <main className="relative mx-auto flex w-full max-w-7xl flex-1 items-center px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <section className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,460px)] lg:gap-16">
          <div className="order-2 mx-auto max-w-2xl space-y-6 text-center lg:order-1 lg:mx-0 lg:text-left">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-gold">
              Seu bolão. Seu palpite. Sua disputa.
            </p>
            <h1 className="text-4xl font-bold tracking-[-0.03em] text-app-foreground sm:text-5xl lg:text-6xl">
              Bolão do Lobo
            </h1>
            <p className="mx-auto max-w-xl text-base leading-7 text-app-muted sm:text-lg lg:mx-0">
              Organize bolões esportivos, registre seus palpites e acompanhe a classificação em um
              só lugar.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
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

          <div className="home-logo-stage order-1 mx-auto flex w-full max-w-[280px] items-center justify-center lg:order-2 lg:max-w-[460px]">
            <Image
              alt="Logo do Bolão do Lobo"
              className="home-logo-float h-auto w-full object-contain"
              height={512}
              priority
              sizes="(max-width: 639px) 280px, (max-width: 1023px) 320px, 460px"
              src="/brand/bolao-do-lobo-ui.webp"
              width={512}
            />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
