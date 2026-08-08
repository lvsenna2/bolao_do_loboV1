const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);

function isSafeRelativeUrl(value?: string | null) {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}

export function getPostLoginDestination(callbackUrl?: string, role?: string | null) {
  if (role && adminRoles.has(String(role))) {
    return "/admin";
  }

  if (isSafeRelativeUrl(callbackUrl)) {
    return callbackUrl;
  }

  return "/dashboard";
}

export function getPostLoginDestinationFromAuthResult(
  callbackUrl?: string,
  role?: string | null,
  authResultUrl?: string | null
) {
  if (role && adminRoles.has(String(role))) {
    return "/admin";
  }

  if (isSafeRelativeUrl(authResultUrl)) {
    return authResultUrl;
  }

  if (isSafeRelativeUrl(callbackUrl)) {
    return callbackUrl;
  }

  return "/dashboard";
}
