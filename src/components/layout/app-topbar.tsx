import type { Session } from "next-auth";
import { Bell, Search } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

type AppTopbarProps = {
  mode?: "user" | "admin";
  user: Session["user"];
};

export function AppTopbar({ mode = "user", user }: AppTopbarProps) {
  const userMode = mode === "user";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b backdrop-blur",
        userMode
          ? "border-white/10 bg-[#00145a]/88 text-white"
          : "border-app-border bg-app-background/90"
      )}
    >
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {userMode ? (
          <BrandLogo />
        ) : (
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-gold">
              Administracao
            </p>
            <p className="truncate text-sm font-medium text-app-muted">Gestao da plataforma</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            aria-label="Pesquisar"
            className={cn(
              "hidden h-10 w-10 items-center justify-center rounded-button border transition sm:inline-flex",
              userMode
                ? "border-white/15 bg-white/8 text-white/75 hover:border-brand-gold hover:text-brand-gold"
                : "border-app-border bg-app-surface text-app-muted hover:border-brand-blue hover:text-brand-blue"
            )}
            type="button"
          >
            <Search aria-hidden className="h-4 w-4" />
          </button>
          <Link
            aria-label="Notificacoes"
            className={cn(
              "relative inline-flex h-10 w-10 items-center justify-center rounded-button border transition",
              userMode
                ? "border-white/15 bg-white/8 text-white/75 hover:border-brand-gold hover:text-brand-gold"
                : "border-app-border bg-app-surface text-app-muted hover:border-brand-blue hover:text-brand-blue"
            )}
            href={"/notificacoes" as Route}
          >
            <Bell aria-hidden className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-gold" />
          </Link>
          {userMode ? null : <ThemeToggle />}
          <div
            className={cn(
              "hidden items-center gap-2 rounded-button border p-1 pr-2 md:flex",
              userMode
                ? "border-white/15 bg-white/8 text-white"
                : "border-app-border bg-app-surface"
            )}
          >
            <Avatar className="h-8 w-8" name={user.name} src={user.image} />
            <span
              className={cn(
                "max-w-32 truncate text-sm font-medium",
                userMode ? "text-white" : "text-app-foreground"
              )}
            >
              {user.name}
            </span>
            <Badge>{user.role}</Badge>
          </div>
          <SignOutButton compact />
        </div>
      </div>
    </header>
  );
}
