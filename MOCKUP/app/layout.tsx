import type { Metadata } from "next";
import "@fontsource/open-sauce-one/400.css";
import "@fontsource/open-sauce-one/700.css";
import "./global.css";

export const metadata: Metadata = {
  title: "FANTACER - Gioca e Vinci",
  description: "Il primo gioco semiserio del distretto ceramico",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className="antialiased font-open-sauce"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}