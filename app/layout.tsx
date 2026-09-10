import type {
  Metadata,
  Viewport,
} from "next";

import "./globals.css";

import PWARegister from "./components/pwa-register";
import LiveNotificationCenter from "./components/live-notification-center";
import DashboardLiveOperations from "./components/dashboard-live-operations";
import DashboardAttendanceLinks from "./components/dashboard-attendance-links";
import DashboardHomeEnhancer from "./components/dashboard-home-enhancer";
import ModuleNavigationFeedback from "./components/module-navigation-feedback";
import SidebarBranchClickFix from "./components/sidebar-branch-click-fix";
import GlobalMobileNav from "./components/global-mobile-nav";
import GlobalDesktopNav from "./components/global-desktop-nav";
import AttendanceAutomationCenter from "./components/attendance-automation-center";
import PaymentInfoShortcut from "./components/payment-info-shortcut";
import StudentPaymentStatusEnhancer from "./components/student-payment-status-enhancer";
import StudentMessageHistoryEnhancer from "./components/student-message-history-enhancer";
import WhatsAppSafeOpen from "./components/whatsapp-safe-open";

export const metadata: Metadata = {
  title: {
    default: "SprintOS",
    template: "%s | SprintOS",
  },

  description:
    "Sprint Yüzme Okulu Yönetim Sistemi",

  applicationName: "SprintOS",

  manifest: "/manifest.webmanifest?v=5",

  icons: {
    icon: [
      {
        url: "/icons/icon-512.png?v=5",
        sizes: "512x512",
        type: "image/png",
      },
    ],

    apple: [
      {
        url: "/icons/apple-touch-icon.png?v=5",
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
        <WhatsAppSafeOpen />
        <GlobalMobileNav />
        <GlobalDesktopNav />
        {children}

        <DashboardHomeEnhancer />
        <DashboardLiveOperations />
        <DashboardAttendanceLinks />
        <ModuleNavigationFeedback />
        <SidebarBranchClickFix />
        <AttendanceAutomationCenter />
        <PaymentInfoShortcut />
        <StudentPaymentStatusEnhancer />
        <StudentMessageHistoryEnhancer />
        <PWARegister />
        <LiveNotificationCenter />
      </body>
    </html>
  );
}
