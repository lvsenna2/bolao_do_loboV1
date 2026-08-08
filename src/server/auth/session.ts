import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";

import { authOptions } from "./options";
import { canAccessAdmin } from "./rbac";

const getCachedSession = unstable_cache(
  async () => getServerSession(authOptions),
  ["auth-session"],
  {
    revalidate: 60,
    tags: ["auth-session"]
  }
);

export async function getCurrentSession() {
  await headers();

  return getCachedSession();
}

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
