import type { NextConfig } from "next";

/**
 * A biometria (passkey) fica presa ao dominio onde foi cadastrada. Quem abre o app
 * pelo endereco antigo da Vercel recebe um bloqueio do proprio aparelho, entao esses
 * hosts sao redirecionados para o dominio oficial antes de qualquer tela carregar.
 * Previews da Vercel (`*-git-*.vercel.app`) nao entram na lista de proposito.
 */
const legacyHosts = (process.env.LEGACY_HOSTS ?? "bolaodolobo.vercel.app")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const canonicalHost = process.env.CANONICAL_HOST ?? "www.simuladorcopa2026.com.br";

const nextConfig: NextConfig = {
  async redirects() {
    return legacyHosts.map((host) => ({
      destination: `https://${canonicalHost}/:path*`,
      has: [{ type: "host" as const, value: host }],
      permanent: false,
      source: "/:path*"
    }));
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    webVitalsAttribution: ["FCP", "LCP"]
  },
  images: {
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    dangerouslyAllowSVG: true,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60
  },
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true
};

export default nextConfig;
