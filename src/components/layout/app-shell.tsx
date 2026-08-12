import { Suspense, type ReactNode } from "react";
import type { Session } from "next-auth";
import { PawPrint } from "lucide-react";

import { cn } from "@/lib/utils";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { UnreadNotificationBadge } from "./unread-notification-badge";
import { XpNotificationToast } from "./xp-notification-toast";

type AppShellProps = {
  children: ReactNode;
  mode?: "user" | "admin";
  user: Session["user"];
};

export function AppShell({ children, mode = "user", user }: AppShellProps) {
  return (
    <div
      className={cn(
        "min-h-screen text-app-foreground",
        mode === "user"
          ? "bg-[#050505] bg-[radial-gradient(circle_at_top_left,rgba(242,185,28,0.16),transparent_34%),linear-gradient(180deg,#17130a_0%,#090909_42%,#020202_100%)] text-white"
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
            "flex min-w-0 flex-1 flex-col lg:pb-0",
            mode === "user" ? "pb-20" : "pb-0",
            mode === "user" ? "min-h-screen" : ""
          )}
        >
          <AppTopbar
            mode={mode}
            notificationBadge={
              mode === "user" ? (
                <Suspense fallback={null}>
                  <UnreadNotificationBadge userId={user.id} />
                </Suspense>
              ) : null
            }
            user={user}
          />
          <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
        </div>
      </div>
      {mode === "user" ? <XpNotificationToast /> : null}
      {mode === "user" ? <MobileBottomNav /> : null}
    </div>
  );
}
