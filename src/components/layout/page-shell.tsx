import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageShellProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  eyebrow?: string;
  title: string;
};

export function PageShell({
  actions,
  children,
  className,
  description,
  eyebrow,
  title
}: PageShellProps) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8", className)}>
      <header className="mb-6 flex flex-col gap-4 border-b border-app-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-gold">
              {eyebrow}
            </p>
          ) : null}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-app-foreground sm:text-3xl">{title}</h1>
            {description ? (
              <p className="max-w-2xl text-sm leading-6 text-app-muted">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
