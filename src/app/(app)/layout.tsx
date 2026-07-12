import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/server/auth/session";
import { getUnreadNotificationCount } from "@/features/user/data/user-data";

type ProtectedLayoutProps = {
  children: ReactNode;
};

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const user = await requireUser();
  const unreadNotificationCount = await getUnreadNotificationCount(user.id);

  return (
    <AppShell unreadNotificationCount={unreadNotificationCount} user={user}>
      {children}
    </AppShell>
  );
}
