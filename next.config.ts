import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['@/components/ui', 'lucide-react'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 768, 1024, 1280, 1536],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zdfverdwdsigizxktilz.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },
  allowedDevOrigins: ['192.168.1.14', '*.trycloudflare.com'],
};

export default withSentryConfig(nextConfig, {
  silent: process.env.NODE_ENV !== "production",
  sourcemaps: { disable: true },
  webpack: { treeshake: { removeDebugLogging: true } },
});
