"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

import { cn } from "@/lib/utils";
import type { NavigationItem } from "./navigation";

type NavigationListProps = {
  className?: string;
  compact?: boolean;
  items: NavigationItem[];
  orientation?: "vertical" | "horizontal";
};

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavigationList({
  className,
  compact = false,
  items,
  orientation = "vertical"
}: NavigationListProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegacao principal"
      className={cn(
        orientation === "vertical" ? "flex flex-col gap-1" : "flex items-center gap-1",
        className
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActiveRoute(pathname, item.href);

        return (
          <Link
            key={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center gap-3 rounded-button px-3 text-sm font-medium transition",
              active
                ? "bg-brand-gold text-slate-950 shadow-sm"
                : "text-app-muted hover:bg-app-elevated hover:text-app-foreground",
              compact ? "h-12 flex-col justify-center gap-1 px-1 text-[10px] leading-none" : ""
            )}
            href={item.href as Route}
            title={compact ? item.label : undefined}
          >
            <Icon aria-hidden className="h-4 w-4 shrink-0" />
            <span className={compact ? "max-w-full truncate" : ""}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
