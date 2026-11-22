import type { Metadata } from "next";
import type { ReactNode } from "react";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./globals.css";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { getCurrentUser, getNotifications } from "@/lib/data-service";

config.autoAddCss = false;

export const metadata: Metadata = {
  title: {
    default: "CPK Karachi · Vehicle Tracking & Detection",
    template: "%s · CPK Karachi",
  },
  description: "AI-powered vehicle tracking and detection dashboard.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [user, notifications] = await Promise.all([getCurrentUser(), getNotifications()]);
  return (
    <html lang="en">
      <body>
        <DashboardLayout user={user} notifications={notifications}>
          {children}
        </DashboardLayout>
      </body>
    </html>
  );
}
