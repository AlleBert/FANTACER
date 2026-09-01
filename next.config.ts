import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL mancante: richiesta per images.remotePatterns (nessun fallback implicito a production).',
  );
}

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
        hostname: new URL(supabaseUrl).hostname,
        pathname: '/storage/**',
      },
    ],
  },
  allowedDevOrigins: ['192.168.1.14', '*.trycloudflare.com'],
};

const config: NextConfig = withSentryConfig(nextConfig, {
  silent: process.env.NODE_ENV !== "production",
  sourcemaps: { disable: true },
  webpack: { treeshake: { removeDebugLogging: true } },
});

// Bundle analyzer: attivo solo quando ANALYZE=true (npm run analyze).
let wrapped: NextConfig = config;
if (process.env.ANALYZE === "true") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const withBundleAnalyzer = require("@next/bundle-analyzer")({
    enabled: true,
    openAnalyzer: false,
  });
  wrapped = withBundleAnalyzer(config);
}

export default wrapped;
