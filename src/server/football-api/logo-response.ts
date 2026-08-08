const successCacheHeader =
  "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";

function getInitials(name: string | null | undefined) {
  const value = name?.trim() || "Logo";

  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function fallbackSvg(label: string) {
  const initials = escapeSvgText(getInitials(label));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="${initials}">
  <rect width="96" height="96" rx="48" fill="#141412"/>
  <circle cx="48" cy="48" r="42" fill="none" stroke="#F2B91C" stroke-width="4"/>
  <text x="48" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#FFFFFF">${initials}</text>
</svg>`;
}

export function footballLogoFallback(label: string, status = 200) {
  return new Response(fallbackSvg(label), {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Content-Type": "image/svg+xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    },
    status
  });
}

function isAllowedApiSportsUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      (url.hostname === "media.api-sports.io" || url.hostname.endsWith(".api-sports.io"))
    );
  } catch {
    return false;
  }
}

type FootballLogoResponseOptions = {
  apiId: number;
  fallbackLabel: string;
  kind: "leagues" | "teams";
  storedLogo?: string | null;
};

export async function createFootballLogoResponse({
  apiId,
  fallbackLabel,
  kind,
  storedLogo
}: FootballLogoResponseOptions) {
  const canonicalUrl = `https://media.api-sports.io/football/${kind}/${apiId}.png`;
  const storedUrl = storedLogo?.trim();
  const candidates = [
    storedUrl && isAllowedApiSportsUrl(storedUrl) ? storedUrl : null,
    canonicalUrl
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        cache: "force-cache",
        headers: {
          Accept: "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8",
          "User-Agent": "BolaoDoLobo/1.0"
        },
        next: {
          revalidate: 604800
        }
      });
      const contentType = response.headers.get("content-type") || "image/png";

      if (!response.ok || !contentType.toLowerCase().startsWith("image/") || !response.body) {
        continue;
      }

      return new Response(response.body, {
        headers: {
          "Cache-Control": successCacheHeader,
          "Content-Type": contentType,
          "X-Content-Type-Options": "nosniff"
        }
      });
    } catch {
      // Tenta a URL canonica antes de usar o fallback local.
    }
  }

  return footballLogoFallback(fallbackLabel);
}
