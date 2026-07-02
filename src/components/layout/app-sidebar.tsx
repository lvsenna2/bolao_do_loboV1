"use client";

import type { Session } from "next-auth";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/brand/brand-logo";
import { adminNavigationItems, mainNavigationItems } from "./navigation";
import { NavigationList } from "./navigation-list";

type AppSidebarProps = {
  mode?: "user" | "admin";
  user: Session["user"];
};

export function AppSidebar({ mode = "user", user }: AppSidebarProps) {
  const items = mode === "admin" ? adminNavigationItems : mainNavigationItems;

  return (
    <aside className="hidden min-h-screen w-72 shrink-0 border-r border-app-border bg-app-surface lg:sticky lg:top-0 lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-app-border px-5">
        <BrandLogo href={mode === "admin" ? "/admin" : "/dashboard"} />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <NavigationList items={items} />
      </div>
      <div className="border-t border-app-border p-4">
        <div className="flex items-center gap-3 rounded-card bg-app-elevated p-3">
          <Avatar name={user.name} src={user.image} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-app-foreground">{user.name}</p>
            <p className="truncate text-xs text-app-muted">{user.email}</p>
          </div>
          <Badge>{user.role}</Badge>
        </div>
      </div>
    </aside>
  );
}
