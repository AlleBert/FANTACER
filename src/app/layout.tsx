import type { Metadata, Viewport } from "next";
import "./globals.css";
import { dictionaries } from "@/i18n";
import { Providers } from "@/components/providers";
import { Analytics } from "@vercel/analytics/next";

const siteUrl = "https://www.fantacer.com";

/**
 * Locale di default (build-time/statico). Il locale effettivo viene risolto dal
 * proxy (cookie sticky da Accept-Language) e applicato client-side da
 * `LocaleProvider`: così il root layout non legge cookie/header e le pagine
 * possono essere statiche (servite dal CDN) invece che SSR a ogni richiesta.
 */
const DEFAULT_LOCALE = "it" as const;

const dict = dictionaries[DEFAULT_LOCALE];

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: dict["meta.title"],
  description: dict["meta.description"],
  alternates: {
    canonical: "/",
    languages: {
      it: "/",
      en: "/",
      "x-default": "/",
    },
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: dict["meta.title"],
    description: dict["meta.description"],
    siteName: "FANTACER",
    type: "website",
    url: `${siteUrl}/`,
    locale: "it_IT",
  },
  twitter: {
    card: "summary_large_image",
    title: dict["meta.title"],
    description: dict["meta.description"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#231f20",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "FANTACER",
        url: `${siteUrl}/`,
        logo: `${siteUrl}/brand/foto-profilo.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: `${siteUrl}/`,
        name: "FANTACER",
        inLanguage: DEFAULT_LOCALE,
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "Game",
        "@id": `${siteUrl}/#game`,
        name: "FANTACER",
        description: dict["meta.description"],
        applicationCategory: "Game",
        inLanguage: DEFAULT_LOCALE,
        url: `${siteUrl}/`,
        provider: { "@id": `${siteUrl}/#organization` },
      },
    ],
  };

  return (
    // "suppressHydrationWarning" è utile se usi librerie come next-themes
    <html suppressHydrationWarning lang={DEFAULT_LOCALE} className="antialiased scroll-smooth">
      <body
        suppressHydrationWarning
        className="flex flex-col text-black font-['Open_Sauce_One',_sans-serif]"
      >
        {process.env.NODE_ENV === "development" && (
          <>
            {/* react-scan e react-grab devono girare PRIMA di React per tracciare i re-render:
                serve un blocco sincrono, async/defer renderebbero l'instrumentazione inutile.
                react-grab 0.2.0 va caricato per primo: react-scan rileva window.__REACT_GRAB__
                e usa questa versione, evitando il warning "react-grab outdated". */}
            {/* eslint-disable-next-line @next/next/no-sync-scripts */}
            <script src="https://unpkg.com/react-grab@0.2.0/dist/index.global.js" crossOrigin="anonymous" />
            {/* eslint-disable-next-line @next/next/no-sync-scripts */}
            <script src="https://unpkg.com/react-scan/dist/auto.global.js" crossOrigin="anonymous" />
          </>
        )}
        <Providers locale={DEFAULT_LOCALE}>{children}</Providers>
        <Analytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
