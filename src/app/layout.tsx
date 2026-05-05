import type { Metadata, Viewport } from "next";
import "@fontsource/open-sauce-one/400.css";
import "@fontsource/open-sauce-one/700.css";
import "./global.css";

export const metadata: Metadata = {
  title: "FANTACER - Gioca e Vinci",
  description: "Il primo gioco semiserio del distretto ceramico",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="antialiased scroll-smooth">
      <body className="min-h-screen flex flex-col bg-white text-black">
        {children}
      </body>
    </html>
  );
}
