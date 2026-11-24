import type { Metadata } from "next";
import type { ReactNode } from "react";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./globals.css";
import { AuthBootstrap } from "@/components/auth/AuthBootstrap";

config.autoAddCss = false;

export const metadata: Metadata = {
  title: {
    default: "CPK Karachi · Vehicle Tracking & Detection",
    template: "%s · CPK Karachi",
  },
  description: "AI-powered vehicle tracking and detection dashboard.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthBootstrap />
        {children}
      </body>
    </html>
  );
}
