const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);

function getSafeRelativeUrl(value?: string | null) {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return undefined;
}

export function getPostLoginDestination(callbackUrl?: string, role?: string | null) {
  if (role && adminRoles.has(String(role))) {
    return "/admin";
  }

  return getSafeRelativeUrl(callbackUrl) ?? "/dashboard";
}

export function getPostLoginDestinationFromAuthResult(
  callbackUrl?: string,
  role?: string | null,
  authResultUrl?: string | null
) {
  if (role && adminRoles.has(String(role))) {
    return "/admin";
  }

  return getSafeRelativeUrl(authResultUrl) ?? getSafeRelativeUrl(callbackUrl) ?? "/dashboard";
}
