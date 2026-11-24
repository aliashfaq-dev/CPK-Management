"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { AppNotification, User } from "@/types";
import { cn } from "@/lib/utils";
import { Header } from "./Header";
import { MobileNavigation } from "./MobileNavigation";
import { Sidebar } from "./Sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
  user: User;
  notifications: AppNotification[];
}

export function DashboardLayout({ children, user, notifications }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleSidebar = useCallback(() => setCollapsed((value) => !value), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <MobileNavigation open={mobileOpen} onClose={closeMobile} />
      <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-200", collapsed ? "md:pl-[72px]" : "md:pl-72")}>
        <Header user={user} notifications={notifications} onMenuClick={openMobile} />
        <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
