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

  return {
    metadataBase: new URL(siteUrl),
    title: dict["meta.title"],
    description: dict["meta.description"],
    icons: {
      icon: "/favicon.svg",
    },
    openGraph: {
      title: dict["meta.title"],
      description: dict["meta.description"],
      siteName: "FANTACER",
      type: "website",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#814545ff", // Opzionale: imposta il colore della barra browser
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    // "suppressHydrationWarning" è utile se usi librerie come next-themes
    <html suppressHydrationWarning lang={locale} className="antialiased scroll-smooth">
      <body
        suppressHydrationWarning
        className="flex flex-col text-black font-['Open_Sauce_One',_sans-serif]"
      >
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
