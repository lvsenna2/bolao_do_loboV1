import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Geist } from "next/font/google";
import "./globals.css";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeScript } from "@/components/layout/theme-script";

const WhatsappContactButton = dynamic(
  () =>
    import("@/components/layout/whatsapp-contact-button").then(
      (mod) => mod.WhatsappContactButton
    ),
  { ssr: false }
);

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
