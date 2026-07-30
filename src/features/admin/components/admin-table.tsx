"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type AdminTableProps = {
  children: ReactNode;
  className?: string;
};

export function AdminTable({ children, className }: AdminTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const labels = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).map(
      (cell) => cell.textContent?.trim() ?? ""
    );

    table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
      Array.from(row.cells).forEach((cell, index) => {
        cell.dataset.label = labels[index] ?? "";
      });
    });
  }, [children]);

  return (
    <div
      className={cn(
        "rounded-card border border-app-border bg-app-surface md:overflow-hidden",
        className
      )}
    >
      <div className="md:overflow-x-auto">
        <table
          className="block w-full text-left text-sm md:table md:min-w-[780px] md:border-collapse [&_tbody>tr]:block [&_tbody>tr]:overflow-hidden [&_tbody>tr]:rounded-control [&_tbody>tr]:border [&_tbody>tr]:border-app-border [&_tbody>tr]:bg-app-background md:[&_tbody>tr]:table-row md:[&_tbody>tr]:rounded-none md:[&_tbody>tr]:border-0 md:[&_tbody>tr]:bg-transparent"
          ref={tableRef}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

export function AdminTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="hidden border-b border-app-border bg-app-elevated text-xs uppercase tracking-[0.08em] text-app-muted md:table-header-group">
      {children}
    </thead>
  );
}

export function AdminTableBody({ children }: { children: ReactNode }) {
  return (
    <tbody className="block space-y-3 p-3 md:table-row-group md:space-y-0 md:divide-y md:divide-app-border md:p-0">
      {children}
    </tbody>
  );
}

export function AdminTh({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

export function AdminTd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td
      className={cn(
        "grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] items-start gap-3 border-b border-app-border/70 px-3 py-3 align-middle text-app-foreground before:text-[11px] before:font-semibold before:uppercase before:tracking-[0.08em] before:text-app-muted before:content-[attr(data-label)] last:border-b-0 md:table-cell md:border-0 md:px-4 md:py-3 md:before:hidden [&_form]:min-w-0 [&_form]:flex-wrap [&_input]:max-w-full [&_select]:max-w-full",
        className
      )}
    >
      {children}
    </td>
  );
}
