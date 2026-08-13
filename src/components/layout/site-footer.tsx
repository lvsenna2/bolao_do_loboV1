import { Mail } from "lucide-react";

import { SUPPORT_EMAIL, supportMailtoUrl } from "@/lib/support";

export function SiteFooter() {
  return (
    <footer className="relative border-t border-app-border bg-app-background/80">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-app-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>&copy; {new Date().getFullYear()} Bolão do Lobo. Todos os direitos reservados.</p>
        <p className="flex flex-wrap items-center gap-2">
          <Mail aria-hidden className="h-4 w-4 text-brand-gold" />
          <span>Problemas ou dúvidas? Fale com a gente:</span>
          <a className="font-semibold text-brand-gold hover:underline" href={supportMailtoUrl()}>
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </footer>
  );
}
