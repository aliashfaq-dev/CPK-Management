import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsView } from "@/components/settings/SettingsView";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSessionUser } from "@/lib/auth-server";
import { getCameras } from "@/lib/data-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [cameras, user] = await Promise.all([getCameras(), getSessionUser()]);
  if (!user) redirect("/login");
  return (
    <>
      <PageHeader description="Manage application, detection, camera, notification, and profile preferences." />
      <SettingsView cameras={cameras} user={user} />
    </>
  );
}
