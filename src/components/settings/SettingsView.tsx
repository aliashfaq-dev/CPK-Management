"use client";

import { useState } from "react";
import { faBell, faBullseye, faGear, faUser, faVideo } from "@fortawesome/free-solid-svg-icons";
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

const TABS: TabItem[] = [
  { id: "general", label: "General", icon: faGear },
  { id: "detection", label: "Detection", icon: faBullseye },
  { id: "cameras", label: "Cameras", icon: faVideo },
  { id: "notifications", label: "Notifications", icon: faBell },
  { id: "profile", label: "Profile", icon: faUser },
];

export function SettingsView({ cameras, user }: { cameras: Camera[]; user: User }) {
  const [tab, setTab] = useState("general");
  const [settings, setSettings, hydrated] = useLocalStorage<AppSettings>("vts:settings", DEFAULT_SETTINGS);
  const update = (patch: Partial<AppSettings>) => setSettings((current) => ({ ...current, ...patch }));

  return (
    <Card>
      <Tabs items={TABS} value={tab} onChange={setTab} label="Settings sections" />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-5 md:p-8">
        {!hydrated ? (
          <LoadingState label="Loading settings…" />
        ) : (
          <>
            {tab === "general" && <GeneralSettings settings={settings} update={update} />}
            {tab === "detection" && <DetectionSettings settings={settings} update={update} />}
            {tab === "cameras" && <CameraSettings initialCameras={cameras} />}
            {tab === "notifications" && <NotificationSettings settings={settings} update={update} />}
            {tab === "profile" && <ProfileSettings settings={settings} update={update} user={user} />}
          </>
        )}
      </div>
    </Card>
  );
}
