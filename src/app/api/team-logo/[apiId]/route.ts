import { prisma } from "@/server/db";

export const runtime = "nodejs";

const cacheHeader = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800";

function getInitials(name: string | null | undefined) {
  const value = name?.trim() || "Time";

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
    .replace(/"/g, "&quot;");
}

function fallbackSvg(label: string) {
  const initials = escapeSvgText(getInitials(label));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="${initials}">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="#242017"/>
      <stop offset="1" stop-color="#090909"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="48" fill="url(#g)"/>
  <circle cx="48" cy="48" r="42" fill="none" stroke="#F2B91C" stroke-width="4"/>
  <text x="48" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#FFFFFF">${initials}</text>
</svg>`;
}

function svgResponse(label: string, status = 200) {
  return new Response(fallbackSvg(label), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "image/svg+xml; charset=utf-8"
    },
    status
  });
}

function getAllowedLogoUrl(apiId: number, logo: string | null | undefined) {
  const canonicalUrl = `https://media.api-sports.io/football/teams/${apiId}.png`;
  const candidate = logo?.trim() || canonicalUrl;

  try {
    const url = new URL(candidate);

    if (
      ["http:", "https:"].includes(url.protocol) &&
      (url.hostname === "media.api-sports.io" || url.hostname.endsWith(".api-sports.io"))
    ) {
      return url.toString();
    }
  } catch {
    return canonicalUrl;
  }

  return canonicalUrl;
}

type TeamLogoRouteContext = {
  params: Promise<{
    apiId: string;
  }>;
};

export async function GET(_request: Request, context: TeamLogoRouteContext) {
  const { apiId: rawApiId } = await context.params;
  const apiId = Number(rawApiId);

  if (!Number.isInteger(apiId) || apiId <= 0) {
    return svgResponse("Time", 400);
  }

  const team = await prisma.team.findUnique({
    select: {
      logo: true,
      name: true,
      shortName: true
    },
    where: {
      apiId
    }
  });
  const logoUrl = getAllowedLogoUrl(apiId, team?.logo);
  const fallbackLabel = team?.shortName || team?.name || `Time ${apiId}`;

  try {
    const response = await fetch(logoUrl, {
      cache: "force-cache",
      headers: {
        Accept: "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8",
        "User-Agent": "BolaoDoLobo/1.0"
      },
      next: {
        revalidate: 604800
      }
    });

    if (!response.ok) {
      return svgResponse(fallbackLabel);
    }

    const contentType = response.headers.get("content-type") || "image/png";

    if (!contentType.toLowerCase().startsWith("image/")) {
      return svgResponse(fallbackLabel);
    }

    const image = await response.arrayBuffer();

    return new Response(image, {
      headers: {
        "Cache-Control": cacheHeader,
        "Content-Type": contentType
      }
    });
  } catch {
    return svgResponse(fallbackLabel);
  }
}
