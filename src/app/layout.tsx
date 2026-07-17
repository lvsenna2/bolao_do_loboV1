import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

import { ThemeScript } from "@/components/layout/theme-script";
import { Providers } from "./providers";

const geist = Geist({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "Bolao do Lobo",
  description: "Plataforma para gerenciamento de boloes esportivos online.",
  icons: {
    apple: "/brand/bolao-do-lobo-logo.png",
    icon: "/brand/bolao-do-lobo-logo.png"
  }
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
      <body className={geist.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
