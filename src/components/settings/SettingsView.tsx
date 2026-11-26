"use client";

import { useMemo, useState } from "react";
import { faBell, faBullseye, faGear, faUser, faUsers, faVideo } from "@fortawesome/free-solid-svg-icons";
import type { AppSettings, Camera, User } from "@/types";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { CameraSettings } from "./CameraSettings";
import { DetectionSettings } from "./DetectionSettings";
import { GeneralSettings } from "./GeneralSettings";
import { NotificationSettings } from "./NotificationSettings";
import { ProfileSettings } from "./ProfileSettings";
import { UsersSettings } from "./UsersSettings";

const BASE_TABS: TabItem[] = [
  { id: "general", label: "General", icon: faGear },
  { id: "detection", label: "Detection", icon: faBullseye },
  { id: "cameras", label: "Cameras", icon: faVideo },
  { id: "notifications", label: "Notifications", icon: faBell },
  { id: "profile", label: "Profile", icon: faUser },
];

export function SettingsView({ cameras, user }: { cameras: Camera[]; user: User }) {
  const isAdmin = user.role === "admin";
  const tabs = useMemo<TabItem[]>(
    () => (isAdmin ? [...BASE_TABS, { id: "users", label: "Users", icon: faUsers }] : BASE_TABS),
    [isAdmin],
  );
  const [tab, setTab] = useState("general");
  const [settings, setSettings, hydrated] = useLocalStorage<AppSettings>("vts:settings", DEFAULT_SETTINGS);
  const update = (patch: Partial<AppSettings>) => setSettings((current) => ({ ...current, ...patch }));

  return (
    <Card>
      <Tabs items={tabs} value={tab} onChange={setTab} label="Settings sections" />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-5 md:p-8">
        {!hydrated ? (
          <LoadingState label="Loading settings…" />
        ) : (
          <>
            {tab === "general" && <GeneralSettings settings={settings} update={update} />}
            {tab === "detection" && <DetectionSettings settings={settings} update={update} />}
            {tab === "cameras" && <CameraSettings initialCameras={cameras} />}
            {tab === "notifications" && <NotificationSettings settings={settings} update={update} />}
            {tab === "profile" && <ProfileSettings user={user} />}
            {tab === "users" && isAdmin && <UsersSettings currentUserId={user.id} />}
          </>
        )}
      </div>
    </Card>
  );
}
