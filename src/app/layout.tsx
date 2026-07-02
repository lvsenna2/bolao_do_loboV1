import type { Metadata } from "next";
import "./globals.css";

import { ThemeScript } from "@/components/layout/theme-script";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Bolao do Lobo",
  description: "Plataforma para gerenciamento de boloes esportivos online."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
