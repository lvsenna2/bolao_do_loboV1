const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);

export function getPostLoginDestination(callbackUrl?: string, role?: string | null) {
  if (role && adminRoles.has(String(role))) {
    return "/admin";
  }

  if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
    return callbackUrl;
  }

  return "/dashboard";
}
