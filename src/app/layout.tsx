import type { Metadata, Viewport } from "next";
import "@fontsource/open-sauce-one/400.css";
import "@fontsource/open-sauce-one/700.css";
import "./globals.css";

const siteUrl = "https://fantacer.it";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "FANTACER - Gioca e Vinci",
  description: "Il primo gioco semiserio del distretto ceramico",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "FANTACER - Gioca e Vinci",
    description: "Il primo gioco semiserio del distretto ceramico",
    siteName: "FANTACER",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#814545ff", // Opzionale: imposta il colore della barra browser
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // "suppressHydrationWarning" è utile se usi librerie come next-themes
    <html suppressHydrationWarning lang="it" className="antialiased scroll-smooth">
      <body
        suppressHydrationWarning
        className="flex flex-col text-black font-['Open_Sauce_One',_sans-serif]"
      >
        {children}
      </body>
    </html>
  );
}
