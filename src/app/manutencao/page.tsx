import Image from "next/image";

export const metadata = {
  title: "Manutenção | Bolão do Lobo"
};

export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-app-background px-6 py-12 text-app-foreground">
      <section className="w-full max-w-lg rounded-3xl border border-app-border bg-app-surface p-8 text-center shadow-xl sm:p-12">
        <Image
          alt="Bolão do Lobo"
          className="mx-auto h-auto w-28"
          height={112}
          priority
          src="/brand/bolao-do-lobo-ui.webp"
          width={112}
        />
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-app-muted">
          Manutenção programada
        </p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Voltamos em 1º de setembro</h1>
        <p className="mt-4 text-base leading-7 text-app-muted">
          Estamos preparando o Bolão do Lobo para voltar com estabilidade. Obrigado pela
          compreensão.
        </p>
      </section>
    </main>
  );
}
