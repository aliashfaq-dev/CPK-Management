import { Toggle } from "@/components/ui/Toggle";
import { SettingsSection } from "./SettingsSection";
import type { SectionProps } from "./GeneralSettings";

export function NotificationSettings({ settings, update }: SectionProps) {
  return (
    <SettingsSection title="Notifications" description="Choose how you hear about camera and detection activity.">
      <div className="divide-y divide-line">
        <Toggle label="Email notifications" description="Receive daily summaries and camera alerts by email." checked={settings.emailNotifications} onChange={(value) => update({ emailNotifications: value })} />
        <Toggle label="System notifications" description="Show alerts inside the application." checked={settings.systemNotifications} onChange={(value) => update({ systemNotifications: value })} />
        <Toggle label="Detection alerts" description="Alert me when a flagged vehicle is detected." checked={settings.detectionAlerts} onChange={(value) => update({ detectionAlerts: value })} />
      </div>
    </SettingsSection>
  );
}
