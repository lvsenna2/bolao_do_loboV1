import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { cache } from "react";

import { authOptions } from "./options";
import { canAccessAdmin } from "./rbac";

export const getCurrentSession = cache(() => getServerSession(authOptions));

export async function requireUser() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (!canAccessAdmin(user.role)) {
    redirect("/");
  }

  return user;
}
