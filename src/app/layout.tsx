import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeScript } from "@/components/layout/theme-script";
import { WhatsappContactButton } from "@/components/layout/whatsapp-contact-button";

const geist = Geist({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "Bolão do Lobo",
  description: "Plataforma para gerenciamento de bolões esportivos online.",
  icons: {
    apple: "/brand/bolao-do-lobo-apple.png",
    icon: "/brand/bolao-do-lobo-icon.png"
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
        {children}
        <WhatsappContactButton />
        <SpeedInsights />
      </body>
    </html>
  );
}
