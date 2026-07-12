import type { ReactNode } from "react";
import { PawPrint } from "lucide-react";

type AuthCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <section className="auth-card-enter w-full rounded-card border border-app-border bg-app-surface/95 p-6 shadow-soft backdrop-blur-xl sm:p-7">
      <div className="mb-6 flex items-start gap-4">
        <span
          aria-hidden="true"
          className="auth-card-mark inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-button bg-brand-gold text-slate-950 shadow-soft"
        >
          <PawPrint className="h-7 w-7" />
        </span>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-gold">
            Bolao do Lobo
          </p>
          <h2 className="text-2xl font-bold text-app-foreground">{title}</h2>
          <p className="text-sm leading-6 text-app-muted">{description}</p>
        </div>
      </div>
      {children}
      {footer ? <div className="mt-6 border-t border-app-border pt-5">{footer}</div> : null}
    </section>
  );
}
