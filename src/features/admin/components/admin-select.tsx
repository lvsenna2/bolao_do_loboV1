import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type AdminSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

export function AdminSelect({ className, label, ...props }: AdminSelectProps) {
  const select = (
    <select
      className={cn(
        "h-10 rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20",
        className
      )}
      {...props}
    />
  );

  if (!label) {
    return select;
  }

  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-app-foreground">{label}</span>
      {select}
    </label>
  );
}
