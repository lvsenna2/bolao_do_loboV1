const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);

export function getPostLoginDestination(callbackUrl?: string, role?: string | null) {
  if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
    return callbackUrl;
  }

  if (role && adminRoles.has(String(role))) {
    return "/admin";
  }

  return "/dashboard";
}
