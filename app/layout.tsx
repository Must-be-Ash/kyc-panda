import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KYC Panda | x402 KYC Gate Extension",
  description:
    "KYC gate extension for x402 endpoints. Verify once with your wallet, transact anywhere.",
  metadataBase: new URL("https://kyc-panda.vercel.app"),
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "KYC Panda | x402 KYC Gate Extension",
    description:
      "KYC gate extension for x402 endpoints. Verify once with your wallet, transact anywhere.",
    url: "https://kyc-panda.vercel.app",
    siteName: "KYC Panda",
    images: [
      {
        url: "https://kyc-panda.vercel.app/og.png",
        width: 1200,
        height: 630,
        alt: "KYC Panda - x402 KYC Gate Extension",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KYC Panda | x402 KYC Gate Extension",
    description:
      "KYC gate extension for x402 endpoints. Verify once with your wallet, transact anywhere.",
    images: ["https://kyc-panda.vercel.app/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Jersey+25&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={geistMono.variable}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
