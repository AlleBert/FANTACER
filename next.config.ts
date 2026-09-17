import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

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
    // WebP prima di AVIF: resa equivalente sugli asset del sito, encoding molto
    // meno costoso in CPU sull'image optimizer (rilevante sotto picco).
    formats: ['image/webp', 'image/avif'],
    // Default Next = 60s: i loghi sponsor e le foto su Supabase Storage cambiano
    // raramente, quindi 31 giorni evitano ritrasformazioni continue.
    minimumCacheTTL: 60 * 60 * 24 * 31,
    deviceSizes: [96, 128, 256, 384, 640, 768, 1024, 1280, 1536],
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
