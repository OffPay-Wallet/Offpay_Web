import type { Metadata } from "next";
import localFont from "next/font/local";

import { OffpayWebVitals } from "@/components/performance/offpay-web-vitals";
import { AppProviders } from "@/components/providers/app-providers";
import { offpayAppIconPath } from "@/lib/offpay/public-config";

import "./globals.css";

const quicksand = localFont({
  src: "../../public/assets/fonts/Quicksand/Quicksand-VariableFont_wght.ttf",
  variable: "--font-quicksand",
  weight: "300 700",
  display: "swap",
});

const cirka = localFont({
  src: [
    {
      path: "../../public/assets/fonts/cirka/Cirka-Light.otf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/assets/fonts/cirka/Cirka-Bold.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-cirka",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Offpay Web",
  description: "Privy-secured Solana wallet web app for Offpay payments.",
  icons: {
    icon: offpayAppIconPath,
    apple: offpayAppIconPath,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${quicksand.variable} ${cirka.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <OffpayWebVitals />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
