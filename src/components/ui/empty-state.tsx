import type { LucideIcon } from "lucide-react";
import { CircleDashed } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  action?: ReactNode;
  className?: string;
  description: string;
  icon?: LucideIcon;
  title: string;
};

export function EmptyState({
  action,
  className,
  description,
  icon: Icon = CircleDashed,
  title
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-app-border bg-app-surface px-6 py-10 text-center",
        className
      )}
    >
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-app-elevated text-brand-gold">
        <Icon aria-hidden className="h-6 w-6" />
      </span>
      <h2 className="text-base font-semibold text-app-foreground">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-app-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
