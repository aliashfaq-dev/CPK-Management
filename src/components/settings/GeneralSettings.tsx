import type { AppSettings } from "@/types";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SettingsSection } from "./SettingsSection";

export interface SectionProps {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
}

const TIME_ZONES = ["Asia/Karachi", "UTC", "Europe/London", "America/New_York"];
const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];
const LANGUAGES = ["English", "Urdu"];
const toOptions = (values: string[]) => values.map((value) => ({ value, label: value }));

export function GeneralSettings({ settings, update }: SectionProps) {
  return (
    <SettingsSection title="General" description="Basic details about how the application looks and behaves. Changes save automatically in this browser.">
      <Input label="Application name" value={settings.appName} onChange={(e) => update({ appName: e.target.value })} />
      <Select label="Time zone" value={settings.timeZone} onChange={(e) => update({ timeZone: e.target.value })} options={toOptions(TIME_ZONES)} />
      <Select label="Date format" value={settings.dateFormat} onChange={(e) => update({ dateFormat: e.target.value })} options={toOptions(DATE_FORMATS)} />
      <Select label="Language" value={settings.language} onChange={(e) => update({ language: e.target.value })} options={toOptions(LANGUAGES)} />
    </SettingsSection>
  );
}
