import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { getSessionUser } from "@/lib/auth-server";
import { getNotifications } from "@/lib/data-service";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [user, notifications] = await Promise.all([getSessionUser(), getNotifications()]);
  if (!user) redirect("/login");
  return (
    <DashboardLayout user={user} notifications={notifications}>
      {children}
    </DashboardLayout>
  );
}
