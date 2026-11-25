import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/SettingsView";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCameras, getCurrentUser } from "@/lib/data-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [cameras, user] = await Promise.all([getCameras(), getCurrentUser()]);
  return (
    <>
      <PageHeader description="Manage application, detection, camera, notification, and profile preferences." />
      <SettingsView cameras={cameras} user={user} />
    </>
  );
}
