import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { getCurrentUser, getNotifications } from "@/lib/data-service";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [user, notifications] = await Promise.all([getCurrentUser(), getNotifications()]);
  return (
    <AuthGuard fallbackUser={user} notifications={notifications}>
      {children}
    </AuthGuard>
  );
}
