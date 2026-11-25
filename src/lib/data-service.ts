import {
  currentUser,
  notifications,
} from "@/data/mock-data";
import { sql } from "@/lib/db";
import type {
  AnalyticsData,
  AppNotification,
  Camera,
  Detection,
  DetectionStatistics,
  DistributionPoint,
  TimeSeriesPoint,
  User,
  Vehicle,
  VehicleType,
} from "@/types";

const VEHICLE_TYPES: VehicleType[] = ["Car", "Motorcycle", "Truck", "Bus"];

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function vehicleTypeFrom(value: unknown, make = "", model = ""): VehicleType {
  const text = `${String(value ?? "")} ${make} ${model}`.toLowerCase();
  if (/motorcycle|motorbike|bike|scooter/.test(text)) return "Motorcycle";
  if (/truck|lorry|pickup|hino|isuzu npr/.test(text)) return "Truck";
  if (/bus|coach|yutong|higer/.test(text)) return "Bus";
  return "Car";
}

function iso(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export async function getDetections(): Promise<Detection[]> {
  const rows = await sql`
    SELECT
      v.event_id, v.number_plate, v.event_time, v.camera_id,
      v.number_plate_confidence, v.make, v.model, v.colour,
      v.has_plate, e.snapshot_number_plate, e.snapshot_vehicle, e.analysis,
      c.name AS camera_name, c.location
    FROM public.v_events_dashboard v
    LEFT JOIN public.events e ON e.event_id = v.event_id
    LEFT JOIN public.cameras c ON c.camera_id = v.camera_id
    ORDER BY v.event_time DESC NULLS LAST
    LIMIT 5000
  `;

  return rows.map((row) => {
    const make = [row.make, row.model].filter(Boolean).join(" ") || "Unknown vehicle";
    const analysis = row.analysis && typeof row.analysis === "object" ? row.analysis as Record<string, unknown> : {};
    const type = vehicleTypeFrom(analysis.vehicle_type ?? analysis.type ?? row.snapshot_vehicle, String(row.make ?? ""), String(row.model ?? ""));
    return {
      id: String(row.event_id),
      plate: String(row.number_plate || row.snapshot_number_plate || "Not detected"),
      vehicleType: type,
      make,
      color: String(row.colour || "Unknown colour"),
      cameraId: String(row.camera_id || "Unknown camera"),
      cameraName: String(row.camera_name || row.camera_id || "Unknown camera"),
      location: String(row.location || "Location unavailable"),
      detectedAt: iso(row.event_time),
      confidence: asNumber(row.number_plate_confidence) <= 1
        ? asNumber(row.number_plate_confidence) * 100
        : asNumber(row.number_plate_confidence),
    };
  });
}

export async function getRecentDetections(limit: number): Promise<Detection[]> {
  const all = await getDetections();
  return all.slice(0, Math.max(0, limit));
}

export async function getCameras(): Promise<Camera[]> {
  const rows = await sql`
    SELECT c.camera_id, c.name, c.location, c.is_active, c.created_at,
      MAX(e.event_time) AS last_activity,
      COUNT(e.event_id) FILTER (WHERE e.event_time >= CURRENT_DATE) AS detections_today
    FROM public.cameras c
    LEFT JOIN public.events e ON e.camera_id = c.camera_id
    GROUP BY c.camera_id, c.name, c.location, c.is_active, c.created_at
    ORDER BY c.name
  `;

  return rows.map((row) => {
    const lastActivity = iso(row.last_activity || row.created_at);
    const age = lastActivity ? Date.now() - new Date(lastActivity).getTime() : Number.POSITIVE_INFINITY;
    const active = Boolean(row.is_active);
    const status: Camera["status"] = !active ? "offline" : age > 15 * 60 * 1000 ? "warning" : "online";
    return {
      id: String(row.camera_id),
      name: String(row.name || row.camera_id),
      location: String(row.location || "Location unavailable"),
      status,
      lastActivity,
      resolution: "Not reported",
      fps: 0,
      detectionsToday: asNumber(row.detections_today),
    };
  });
}

export async function getVehicles(): Promise<Vehicle[]> {
  const rows = await sql`
    SELECT
      COALESCE(NULLIF(v.plate_key, ''), NULLIF(v.vehicle_key, ''), v.event_id) AS vehicle_ref,
      MAX(v.number_plate) AS number_plate,
      MAX(v.make) AS make,
      MAX(v.model) AS model,
      MAX(v.colour) AS colour,
      COUNT(*) AS total_sightings,
      MIN(v.event_time) AS first_seen,
      MAX(v.event_time) AS last_seen
    FROM public.v_events_dashboard v
    GROUP BY COALESCE(NULLIF(v.plate_key, ''), NULLIF(v.vehicle_key, ''), v.event_id)
    ORDER BY MAX(v.event_time) DESC NULLS LAST
    LIMIT 5000
  `;

  return rows.map((row) => ({
    plate: String(row.number_plate || row.vehicle_ref || "Unknown vehicle"),
    type: vehicleTypeFrom("", String(row.make ?? ""), String(row.model ?? "")),
    make: [row.make, row.model].filter(Boolean).join(" ") || "Unknown vehicle",
    color: String(row.colour || "Unknown colour"),
    totalSightings: asNumber(row.total_sightings),
    firstSeen: iso(row.first_seen),
    lastSeen: iso(row.last_seen),
  }));
}

export async function getStatistics(): Promise<DetectionStatistics> {
  const [eventRows, cameraRows] = await Promise.all([
    sql`SELECT
      COUNT(*) AS total_events,
      COUNT(DISTINCT COALESCE(NULLIF(vehicle_key, ''), NULLIF(plate_key, ''), event_id)) AS total_vehicles,
      COUNT(DISTINCT COALESCE(NULLIF(vehicle_key, ''), NULLIF(plate_key, ''), event_id)) FILTER (WHERE event_time >= CURRENT_DATE) AS today_vehicles,
      COALESCE(AVG(number_plate_confidence), 0) AS accuracy
      FROM public.events`,
    sql`SELECT COUNT(*) AS total_cameras,
      COUNT(*) FILTER (WHERE is_active = true) AS active_cameras
      FROM public.cameras`,
  ]);
  const events = eventRows[0];
  const cams = cameraRows[0];
  return {
    totalVehicles: asNumber(events.total_vehicles),
    totalChange: 0,
    todayVehicles: asNumber(events.today_vehicles),
    todayChange: 0,
    activeCameras: asNumber(cams.active_cameras),
    totalCameras: asNumber(cams.total_cameras),
    activeCamerasChange: 0,
    accuracy: asNumber(events.accuracy) * (asNumber(events.accuracy) <= 1 ? 100 : 1),
    accuracyChange: 0,
  };
}

export async function getActivitySeries(): Promise<TimeSeriesPoint[]> {
  const rows = await sql`
    SELECT date_trunc('hour', event_time) AS hour, COUNT(*) AS detections
    FROM public.events
    WHERE event_time >= NOW() - INTERVAL '24 hours'
    GROUP BY 1 ORDER BY 1
  `;
  const counts = new Map(rows.map((row) => [new Date(String(row.hour)).toISOString().slice(0, 13), asNumber(row.detections)]));
  return Array.from({ length: 24 }, (_, index) => {
    const date = new Date(Date.now() - (23 - index) * 60 * 60 * 1000);
    const key = date.toISOString().slice(0, 13);
    return { label: date.toLocaleTimeString("en", { hour: "numeric", hour12: true }), detections: counts.get(key) ?? 0 };
  });
}

export async function getDistribution(): Promise<DistributionPoint[]> {
  const rows = await sql`
    SELECT COALESCE(NULLIF(e.analysis->>'vehicle_type', ''), NULLIF(e.analysis->>'type', ''), '') AS detected_type,
      COALESCE(v.make, '') AS make, COALESCE(v.model, '') AS model, COUNT(*) AS total
    FROM public.events e
    LEFT JOIN public.v_events_dashboard v ON v.event_id = e.event_id
    GROUP BY 1, 2, 3
  `;
  const totals = new Map<VehicleType, number>(VEHICLE_TYPES.map((type) => [type, 0]));
  for (const row of rows) {
    const type = vehicleTypeFrom(row.detected_type, String(row.make), String(row.model));
    totals.set(type, (totals.get(type) ?? 0) + asNumber(row.total));
  }
  return VEHICLE_TYPES.map((name) => ({ name, value: totals.get(name) ?? 0 }));
}

export async function getAnalytics(days: number): Promise<AnalyticsData> {
  const span = Math.min(90, Math.max(1, Math.floor(days)));
  const [events, cameras] = await Promise.all([
    sql`SELECT v.event_id, v.event_time, v.camera_id, v.number_plate_confidence,
      v.make, v.model, e.analysis
      FROM public.v_events_dashboard v
      LEFT JOIN public.events e ON e.event_id = v.event_id
      WHERE v.event_time >= NOW() - (${span}::text || ' days')::interval
      ORDER BY v.event_time DESC LIMIT 20000`,
    sql`SELECT camera_id, name, is_active FROM public.cameras ORDER BY name`,
  ]);

  const byDay = new Map<string, number>();
  const byHour = new Map<number, number>();
  const now = new Date();
  const last24Hours = now.getTime() - 24 * 60 * 60 * 1000;
  const distribution = new Map<VehicleType, number>(VEHICLE_TYPES.map((type) => [type, 0]));
  const cameraCounts = new Map<string, { count: number; confidence: number; confidenceCount: number }>();
  const confidence = [0, 0, 0, 0, 0];
  for (const row of events) {
    const date = new Date(String(row.event_time));
    if (Number.isNaN(date.getTime())) continue;
    const day = date.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    if (date.getTime() >= last24Hours) {
      byHour.set(date.getHours(), (byHour.get(date.getHours()) ?? 0) + 1);
    }
    const analysis = row.analysis && typeof row.analysis === "object" ? row.analysis as Record<string, unknown> : {};
    const type = vehicleTypeFrom(analysis.vehicle_type ?? analysis.type, String(row.make ?? ""), String(row.model ?? ""));
    distribution.set(type, (distribution.get(type) ?? 0) + 1);
    const cameraId = String(row.camera_id || "unknown");
    const entry = cameraCounts.get(cameraId) ?? { count: 0, confidence: 0, confidenceCount: 0 };
    entry.count += 1;
    const score = asNumber(row.number_plate_confidence);
    if (score > 0) { entry.confidence += score <= 1 ? score * 100 : score; entry.confidenceCount += 1; }
    cameraCounts.set(cameraId, entry);
    if (score > 0) {
      const percent = score <= 1 ? score * 100 : score;
      const bucket = percent < 60 ? 0 : percent < 70 ? 1 : percent < 80 ? 2 : percent < 90 ? 3 : 4;
      confidence[bucket] += 1;
    }
  }
  const trend: TimeSeriesPoint[] = Array.from({ length: span }, (_, index) => {
    const d = new Date(now); d.setDate(now.getDate() - (span - 1 - index));
    const key = d.toISOString().slice(0, 10);
    return { label: d.toLocaleDateString("en", { day: "2-digit", month: "short" }), detections: byDay.get(key) ?? 0 };
  });
  const hourly: TimeSeriesPoint[] = Array.from({ length: 24 }, (_, hour) => ({ label: `${hour.toString().padStart(2, "0")}:00`, detections: byHour.get(hour) ?? 0 }));
  const weekly: TimeSeriesPoint[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, day) => ({
    label,
    detections: events.filter((row) => new Date(String(row.event_time)).getDay() === day).length,
  }));
  const cameraPerformance = cameras.map((camera) => {
    const values = cameraCounts.get(String(camera.camera_id));
    return {
      cameraId: String(camera.camera_id), name: String(camera.name || camera.camera_id),
      detections: values?.count ?? 0,
      uptime: camera.is_active ? 100 : 0,
      accuracy: values?.confidenceCount ? values.confidence / values.confidenceCount : 0,
    };
  });
  return {
    trend,
    distribution: VEHICLE_TYPES.map((name) => ({ name, value: distribution.get(name) ?? 0 })),
    hourly,
    weekly,
    cameraPerformance,
    confidence: ["<60%", "60–69%", "70–79%", "80–89%", "90–100%"].map((range, index) => ({ range, count: confidence[index] })),
  };
}

// Authentication and notification data remain demo-only until the owner supplies
// the intended user/auth API contract. Vehicle and camera data above are live Neon data.
export async function getNotifications(): Promise<AppNotification[]> { return notifications; }
export async function getCurrentUser(): Promise<User> { return currentUser; }
