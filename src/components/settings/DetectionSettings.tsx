import { Toggle } from "@/components/ui/Toggle";
import { SettingsSection } from "./SettingsSection";
import type { SectionProps } from "./GeneralSettings";

export function DetectionSettings({ settings, update }: SectionProps) {
  return (
    <SettingsSection title="Detection" description="Control what the system detects and how strict it is.">
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="min-confidence" className="text-sm font-medium">
            Minimum confidence threshold
          </label>
          <span className="text-sm font-semibold tabular-nums">{settings.minConfidence}%</span>
        </div>
        <input
          id="min-confidence"
          type="range"
          min={50}
          max={99}
          value={settings.minConfidence}
          onChange={(e) => update({ minConfidence: Number(e.target.value) })}
          className="mt-3 w-full accent-accent"
        />
        <p className="mt-1 text-xs text-muted">Detections below this score are hidden from results.</p>
      </div>
      <div className="divide-y divide-line border-t border-line">
        <Toggle label="Vehicle detection" description="Detect and classify vehicles in camera feeds." checked={settings.vehicleDetection} onChange={(value) => update({ vehicleDetection: value })} />
        <Toggle label="License plate detection" description="Read license plates from detected vehicles." checked={settings.plateDetection} onChange={(value) => update({ plateDetection: value })} />
        <Toggle label="Detection notifications" description="Notify me when a new detection is recorded." checked={settings.detectionNotifications} onChange={(value) => update({ detectionNotifications: value })} />
      </div>
    </SettingsSection>
  );
}
