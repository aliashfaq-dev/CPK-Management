import { query } from "@/lib/db";
import { normalizePlate } from "@/lib/detection-query";
import type { AlertRuleSettings, Detection, LiveAlertPayload, WatchlistEntry } from "@/types";

export const DEFAULT_ALERT_RULES: AlertRuleSettings = {
  alertNoPlate: false,
  alertLowConfidence: false,
  lowConfidenceThreshold: 80,
};

const CACHE_TTL_MS = 5_000;

interface AlertCache {
  watchlist?: { expires: number; byPlate: Map<string, string | null> };
  rules?: { expires: number; value: AlertRuleSettings };
}
interface AlertGlobals {
  __cpkAlertCache?: AlertCache;
}
const store = globalThis as typeof globalThis & AlertGlobals;

export function invalidateAlertCache(): void {
  store.__cpkAlertCache = {};
}

export async function listWatchlist(): Promise<WatchlistEntry[]> {
  const result = await query<{ id: string; plate_norm: string; note: string | null; created_at: Date }>(
    "SELECT id, plate_norm, note, created_at FROM public.watchlist ORDER BY created_at DESC",
  );
  return result.rows.map((row) => ({
    id: row.id,
    plateNorm: row.plate_norm,
    note: row.note,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}

async function getWatchlistMap(): Promise<Map<string, string | null>> {
  const cache = (store.__cpkAlertCache ??= {});
  if (cache.watchlist && cache.watchlist.expires > Date.now()) {
    return cache.watchlist.byPlate;
  }
  const rows = await listWatchlist();
  const byPlate = new Map<string, string | null>(rows.map((item) => [item.plateNorm, item.note]));
  cache.watchlist = { expires: Date.now() + CACHE_TTL_MS, byPlate };
  return byPlate;
}

export async function getAlertRuleSettings(): Promise<AlertRuleSettings> {
  const cache = (store.__cpkAlertCache ??= {});
  if (cache.rules && cache.rules.expires > Date.now()) {
    return cache.rules.value;
  }
  try {
    const result = await query<{ value: unknown }>(
      "SELECT value FROM public.app_settings WHERE key = 'alert_rules' LIMIT 1",
    );
    const raw = (result.rows[0]?.value ?? {}) as Record<string, unknown>;
    const threshold = Number(raw.lowConfidenceThreshold);
    const value: AlertRuleSettings = {
      alertNoPlate: Boolean(raw.alertNoPlate),
      alertLowConfidence: Boolean(raw.alertLowConfidence),
      lowConfidenceThreshold: Number.isFinite(threshold) ? Math.min(99, Math.max(10, Math.round(threshold))) : DEFAULT_ALERT_RULES.lowConfidenceThreshold,
    };
    cache.rules = { expires: Date.now() + CACHE_TTL_MS, value };
    return value;
  } catch {
    return DEFAULT_ALERT_RULES;
  }
}

export async function saveAlertRuleSettings(settings: AlertRuleSettings): Promise<AlertRuleSettings> {
  const clean: AlertRuleSettings = {
    alertNoPlate: Boolean(settings.alertNoPlate),
    alertLowConfidence: Boolean(settings.alertLowConfidence),
    lowConfidenceThreshold: Math.min(99, Math.max(10, Math.round(settings.lowConfidenceThreshold))),
  };
  await query(
    `INSERT INTO public.app_settings (key, value)
     VALUES ('alert_rules', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(clean)],
  );
  invalidateAlertCache();
  return clean;
}

/** Evaluates watchlist and optional alert rules for a newly inserted detection. */
export async function evaluateAlertForDetection(detection: Detection): Promise<LiveAlertPayload | null> {
  const [watchlist, rules] = await Promise.all([getWatchlistMap(), getAlertRuleSettings()]);

  if (detection.hasPlate && detection.plate) {
    const norm = normalizePlate(detection.plate);
    if (norm && watchlist.has(norm)) {
      const note = watchlist.get(norm);
      return {
        id: `alert-${detection.id}`,
        severity: "high",
        reason: note ? `Watchlist match (${detection.plate}): ${note}` : `Watchlist match (${detection.plate})`,
        createdAt: detection.detectedAt || new Date().toISOString(),
        event: detection,
      };
    }
  }

  if (rules.alertNoPlate && !detection.hasPlate) {
    return {
      id: `alert-${detection.id}`,
      severity: "medium",
      reason: "No license plate read",
      createdAt: detection.detectedAt || new Date().toISOString(),
      event: detection,
    };
  }

  if (rules.alertLowConfidence && detection.hasPlate && detection.confidence < rules.lowConfidenceThreshold) {
    return {
      id: `alert-${detection.id}`,
      severity: "low",
      reason: `Plate confidence ${detection.confidence.toFixed(1)}% below ${rules.lowConfidenceThreshold}%`,
      createdAt: detection.detectedAt || new Date().toISOString(),
      event: detection,
    };
  }

  return null;
}
