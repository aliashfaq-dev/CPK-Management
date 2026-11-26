"use client";

import { useEffect, useState } from "react";
import type { AlertRuleSettings } from "@/types";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { SettingsSection } from "./SettingsSection";
import type { SectionProps } from "./GeneralSettings";

const DEFAULT_RULES: AlertRuleSettings = {
  alertNoPlate: false,
  alertLowConfidence: false,
  lowConfidenceThreshold: 80,
};

export function NotificationSettings({
  settings,
  update,
  isAdmin = false,
}: SectionProps & { isAdmin?: boolean }) {
  const [rules, setRules] = useState<AlertRuleSettings>(DEFAULT_RULES);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/alerts", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ rules: AlertRuleSettings }>) : null))
      .then((body) => {
        if (body?.rules) setRules(body.rules);
      })
      .catch(() => undefined);
  }, []);

  const saveServerRules = async () => {
    if (!isAdmin || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/settings/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      });
      if (!response.ok) {
        setStatus({ tone: "error", text: "Could not save alert rules." });
        return;
      }
      setStatus({ tone: "success", text: "Server alert rules saved." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection title="Notifications & alert rules" description="Configure realtime alert triggers and local display preferences.">
      <div className="space-y-3 rounded-lg border border-line p-4">
        <div>
          <h3 className="text-sm font-semibold">Realtime alert rules</h3>
          <p className="mt-0.5 text-xs text-muted">
            Watchlist matches always emit a high-severity alert. Administrators can also raise alerts on unreadable or low-confidence plates.
          </p>
        </div>

        <div className="divide-y divide-line">
          <Toggle
            label="Alert when no plate is read"
            description="Emit a warning alert whenever a vehicle passes without a readable plate."
            checked={rules.alertNoPlate}
            onChange={(value) => isAdmin && setRules((current) => ({ ...current, alertNoPlate: value }))}
          />
          <Toggle
            label="Alert on low plate confidence"
            description={`Emit an alert when plate confidence is below ${rules.lowConfidenceThreshold}%.`}
            checked={rules.alertLowConfidence}
            onChange={(value) => isAdmin && setRules((current) => ({ ...current, alertLowConfidence: value }))}
          />
        </div>

        {rules.alertLowConfidence && (
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="alert-confidence-threshold" className="font-medium">
                Confidence alert threshold
              </label>
              <span className="font-semibold tabular-nums">{rules.lowConfidenceThreshold}%</span>
            </div>
            <input
              id="alert-confidence-threshold"
              type="range"
              min={40}
              max={98}
              disabled={!isAdmin}
              value={rules.lowConfidenceThreshold}
              onChange={(e) => setRules((current) => ({ ...current, lowConfidenceThreshold: Number(e.target.value) }))}
              className="mt-2 w-full accent-accent"
            />
          </div>
        )}

        {status && (
          <p role="status" className={status.tone === "success" ? "text-xs text-success-strong" : "text-xs text-danger-strong"}>
            {status.text}
          </p>
        )}

        {isAdmin ? (
          <div>
            <Button variant="primary" size="sm" onClick={() => void saveServerRules()} disabled={saving}>
              {saving ? "Saving…" : "Save alert rules"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted">Only administrators can change server-wide alert rules.</p>
        )}
      </div>

      <div className="divide-y divide-line pt-2">
        <Toggle label="System notifications" description="Show alert banners inside the application." checked={settings.systemNotifications} onChange={(value) => update({ systemNotifications: value })} />
        <Toggle label="Email notifications" description="Daily summary preference for this browser." checked={settings.emailNotifications} onChange={(value) => update({ emailNotifications: value })} />
      </div>
    </SettingsSection>
  );
}
