import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AdminTableProps = {
  children: ReactNode;
  className?: string;
};

export function AdminTable({ children, className }: AdminTableProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-app-border bg-app-surface",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-left text-sm">{children}</table>
      </div>
    </div>
  );
}

export function AdminTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-app-border bg-app-elevated text-xs uppercase tracking-[0.08em] text-app-muted">
      {children}
    </thead>
  );
}

export function AdminTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-app-border">{children}</tbody>;
}

export function AdminTh({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

export function AdminTd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={cn("px-4 py-3 align-middle text-app-foreground", className)}>{children}</td>
  );
}
