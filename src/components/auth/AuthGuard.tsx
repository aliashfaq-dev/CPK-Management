"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import type { AppNotification, User } from "@/types";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CpkLoader } from "@/components/ui/CpkLoader";
import { useAuth } from "@/hooks/useAuth";
import { isSigningOut } from "@/lib/auth";

interface AuthGuardProps {
  children: ReactNode;
  fallbackUser: User;
  notifications: AppNotification[];
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Client-side gate for the dashboard routes: signed-out visitors are sent to /login. */
export function AuthGuard({ children, fallbackUser, notifications }: AuthGuardProps) {
  const router = useRouter();
  const { status, session } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const user = useMemo<User>(
    () =>
      session
        ? {
            ...fallbackUser,
            name: session.name,
            email: session.email,
            role: session.role === "viewer" ? "viewer" : "admin",
            initials: initialsOf(session.name),
          }
        : fallbackUser,
    [session, fallbackUser],
  );

  if (status !== "authenticated") {
    const text = status === "loading" ? "Loading…" : isSigningOut() ? "Signing out..." : "Redirecting to sign in...";
    return <CpkLoader text={text} />;
  }

  return (
    <DashboardLayout user={user} notifications={notifications}>
      {children}
    </DashboardLayout>
  );
}
