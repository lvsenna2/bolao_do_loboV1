import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { PawPrint } from "lucide-react";

import { cn } from "@/lib/utils";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { XpNotificationToast } from "./xp-notification-toast";

type AppShellProps = {
  children: ReactNode;
  mode?: "user" | "admin";
  unreadNotificationCount?: number;
  user: Session["user"];
};

export function AppShell({
  children,
  mode = "user",
  unreadNotificationCount = 0,
  user
}: AppShellProps) {
  return (
    <div
      className={cn(
        "min-h-screen text-app-foreground",
        mode === "user"
          ? "bg-[#00145a] bg-[radial-gradient(circle_at_top_left,rgba(29,78,216,0.75),transparent_34%),linear-gradient(180deg,#0638d6_0%,#001b78_42%,#000b35_100%)] text-white"
          : "bg-app-background"
      )}
      data-shell-mode={mode}
    >
      {mode === "user" ? (
        <div aria-hidden className="wolf-ambience">
          <PawPrint className="wolf-paw wolf-paw-one" />
          <PawPrint className="wolf-paw wolf-paw-two" />
          <PawPrint className="wolf-paw wolf-paw-three" />
          <span className="wolf-moon" />
        </div>
      ) : null}
      <div className="flex min-h-screen">
        <AppSidebar mode={mode} user={user} />
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col pb-20 lg:pb-0",
            mode === "user" ? "min-h-screen" : ""
          )}
        >
          <AppTopbar mode={mode} unreadNotificationCount={unreadNotificationCount} user={user} />
          <main className="flex-1">{children}</main>
        </div>
      </div>
      {mode === "user" ? <XpNotificationToast /> : null}
      {mode === "user" ? <MobileBottomNav /> : null}
    </div>
  );
}
