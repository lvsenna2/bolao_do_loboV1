import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    webVitalsAttribution: ["FCP", "LCP"]
  },
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true
};

export default nextConfig;
