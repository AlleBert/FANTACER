import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "@/lib/locale";
import { dictionaries } from "@/i18n";
import { Providers } from "@/components/providers";

const siteUrl = "https://www.fantacer.com";

async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  return resolveLocale(
    headerStore.get("accept-language") ?? null,
    cookieStore.get(LOCALE_COOKIE)?.value ?? null,
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = dictionaries[locale];

  const headerStore = await headers();
  const pathname = headerStore.get('x-pathname') ?? '/';
  const canonical = pathname === '/' ? '/' : pathname;

  return {
    metadataBase: new URL(siteUrl),
    title: dict["meta.title"],
    description: dict["meta.description"],
    alternates: {
      canonical,
      languages: {
        it: canonical,
        en: canonical,
        "x-default": canonical,
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
      locale: locale === "it" ? "it_IT" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: dict["meta.title"],
      description: dict["meta.description"],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#231f20",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const dict = dictionaries[locale];

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
        inLanguage: locale,
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "Game",
        "@id": `${siteUrl}/#game`,
        name: "FANTACER",
        description: dict["meta.description"],
        applicationCategory: "Game",
        inLanguage: locale,
        url: `${siteUrl}/`,
        provider: { "@id": `${siteUrl}/#organization` },
      },
    ],
  };

  return (
    // "suppressHydrationWarning" è utile se usi librerie come next-themes
    <html suppressHydrationWarning lang={locale} className="antialiased scroll-smooth">
      <body
        suppressHydrationWarning
        className="flex flex-col text-black font-['Open_Sauce_One',_sans-serif]"
      >
        {process.env.NODE_ENV === "development" && (
          // react-scan deve girare PRIMA di React per tracciare i re-render:
          // serve un blocco sincrono, async/defer renderebbero l'instrumentazione inutile.
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script src="https://unpkg.com/react-scan/dist/auto.global.js" crossOrigin="anonymous" />
        )}
        <Providers locale={locale}>{children}</Providers>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}