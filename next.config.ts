import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    webVitalsAttribution: ["FCP", "LCP"]
  },
  images: {
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    dangerouslyAllowSVG: true
  },
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true
};

export default nextConfig;
