import type { ReactNode } from "react";

type AuthCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <section className="w-full rounded-card border border-app-border bg-app-surface p-6 shadow-soft">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-semibold text-brand-gold">Bolao do Lobo</p>
        <h1 className="text-2xl font-bold text-app-foreground">{title}</h1>
        <p className="text-sm leading-6 text-app-muted">{description}</p>
      </div>
      {children}
      {footer ? <div className="mt-6 border-t border-app-border pt-5">{footer}</div> : null}
    </section>
  );
}
