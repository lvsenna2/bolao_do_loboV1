const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RESERVED_SEGMENTS = new Set(["eleicoes-2026", "historico", "nova"]);
const PROMO_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Retorna o slug somente para URLs de campanha que podem ter uma vitrine publica.
 * Rotas fixas e identificadores UUID continuam protegidos pelo login normal do app.
 */
export function getPublicPromoSlug(pathname: string) {
  const match = pathname.match(/^\/rodadas-especiais\/([^/]+)\/?$/i);
  if (!match) return null;

  const slug = match[1].toLowerCase();
  if (RESERVED_SEGMENTS.has(slug) || UUID_PATTERN.test(slug)) return null;
  if (!PROMO_SLUG_PATTERN.test(slug)) return null;

  return slug;
}

export function isPublicPromoPath(pathname: string) {
  return getPublicPromoSlug(pathname) !== null;
}
