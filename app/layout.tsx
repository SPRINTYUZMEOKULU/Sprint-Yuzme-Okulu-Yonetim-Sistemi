import type {
  Metadata,
  Viewport,
} from "next";

import "./globals.css";

import PWARegister from "./components/pwa-register";
import LiveNotificationCenter from "./components/live-notification-center";

export const metadata: Metadata = {
  title: {
    default: "SprintOS",
    template: "%s | SprintOS",
  },

  description:
    "Sprint Yüzme Okulu Yönetim Sistemi",

  applicationName: "SprintOS",

  manifest: "/manifest.webmanifest",

  icons: {
    icon: [
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],

    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },

  appleWebApp: {
    capable: true,
    title: "SprintOS",
    statusBarStyle: "default",
  },

  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#03132f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>
        {children}

        <PWARegister />
        <LiveNotificationCenter />
      </body>
    </html>
  );
}
