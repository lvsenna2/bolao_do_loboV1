import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
