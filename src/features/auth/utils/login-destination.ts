const adminRoles = new Set(["ADMIN", "SUPER_ADMIN"]);

function getSafeRelativeUrl(value?: string | null) {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return undefined;
}

/**
 * Destino pos-login vindo da query. So aceita caminho relativo do proprio site — a query
 * string (UTM do trafego pago, por exemplo) vem junto.
 */
export function getSafeCallbackUrl(value?: string | null) {
  return getSafeRelativeUrl(value);
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
