import type { Metadata, Viewport } from "next";
import "./globals.css";
import PublicFooter from '@/components/public-footer'

export const viewport: Viewport = {
  themeColor: '#1a3a6b',
}

export const metadata: Metadata = {
  title: "Search Star — Build Genuine Skills",
  description: "A platform for building genuine skills through sustained practice, validated by people who know you.",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Log Session',
  },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%231a3a6b'/%3E%3Cpolygon points='32,6 36,24 32,20 28,24' fill='%23fff'/%3E%3Cpolygon points='32,6 36,24 32,28 28,24' fill='%23fff' opacity='0.6'/%3E%3Cpolygon points='58,32 40,28 44,32 40,36' fill='%23fff' opacity='0.6'/%3E%3Cpolygon points='32,58 28,40 32,44 36,40' fill='%23fff' opacity='0.6'/%3E%3Cpolygon points='6,32 24,36 20,32 24,28' fill='%23fff' opacity='0.6'/%3E%3Ccircle cx='32' cy='32' r='3' fill='%23fff'/%3E%3C/svg%3E",
    apple: '/icons/icon-192.png',
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
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        {children}
        <PublicFooter />
      </body>
    </html>
  );
}
