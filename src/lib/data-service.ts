import { query } from "@/lib/db";
import { normalizePlate, ocrFoldPlate } from "@/lib/detection-query";
import { primeEventImageKeys } from "@/lib/image-cache";
import { MAX_PAGE_SIZE, VEHICLE_TYPES } from "@/lib/constants";
import type {
  AnalyticsData,
  AppNotification,
  Camera,
  CameraPerformance,
  Detection,
  DetectionFilters,
  DetectionQuery,
  DetectionSortKey,
  DetectionStatistics,
  DistributionPoint,
  Page,
  TimeSeriesPoint,
  Vehicle,
  VehicleType,
} from "@/types";

/**
 * All reads go through here. Every query is parameterized: user input only ever reaches
 * the database as a bound value, never as SQL text. SQL fragments below are constants.
 */

type Row = Record<string, unknown>;

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function iso(value: unknown): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** Confidence columns may be stored as 0-1 or 0-100; the UI always works in 0-100. */
function toPercent(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? n * 100 : n;
}

const PLATE_CONFIDENCE_SQL =
  "(CASE WHEN v.number_plate_confidence IS NULL THEN NULL WHEN v.number_plate_confidence <= 1 THEN v.number_plate_confidence * 100 ELSE v.number_plate_confidence END)";
const PLATE_NORM_SQL = "upper(regexp_replace(COALESCE(v.number_plate, ''), '[^A-Za-z0-9]', '', 'g'))";
const PLATE_OCR_SQL = `translate(${PLATE_NORM_SQL}, 'OISB', '0158')`;

const SORT_COLUMNS: Record<DetectionSortKey, string> = {
  plate: "v.number_plate",
  vehicleType: "v.vehicle_type",
  cameraId: "v.camera_id",
  detectedAt: "v.event_time",
  confidence: PLATE_CONFIDENCE_SQL,
};

const DETECTION_COLUMNS = `
  v.event_id, v.event_time, v.camera_id, v.number_plate, v.number_plate_confidence,
  v.plate_detection_confidence, v.vehicle_type, v.has_plate, v.plate_key, v.vehicle_key, v.s3_bucket,
  v.analysis_status, v.make, v.model, v.colour,
  c.name AS camera_name, c.location AS camera_location`;

export function rowToDetection(row: Row): Detection {
  const id = String(row.event_id);
  primeEventImageKeys(
    id,
    typeof row.s3_bucket === "string" ? row.s3_bucket : null,
    typeof row.vehicle_key === "string" ? row.vehicle_key : null,
    typeof row.plate_key === "string" ? row.plate_key : null,
  );
  const makeModel = [row.make, row.model].filter((part) => typeof part === "string" && part.trim()).join(" ");
  return {
    id,
    plate: row.has_plate ? String(row.number_plate ?? "") : "",
    hasPlate: Boolean(row.has_plate),
    vehicleType: row.vehicle_type as VehicleType,
    make: makeModel || null,
    color: typeof row.colour === "string" && row.colour.trim() ? row.colour : null,
    analysisStatus: row.analysis_status ? String(row.analysis_status) : null,
    cameraId: String(row.camera_id ?? ""),
    cameraName: String(row.camera_name || row.camera_id || "Unknown camera"),
    location: String(row.camera_location || "Location unavailable"),
    detectedAt: iso(row.event_time),
    confidence: toPercent(row.number_plate_confidence) ?? 0,
    plateDetectionConfidence: toPercent(row.plate_detection_confidence),
    hasVehicleImage: Boolean(row.vehicle_key),
    hasPlateImage: Boolean(row.plate_key),
  };
}

interface Where {
  clause: string;
  params: unknown[];
}

/** Builds `WHERE ...` from filters. Only constant SQL text is concatenated; values are $n params. */
function buildWhere(filters: DetectionFilters): Where {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    conditions.push(sql.replace("?", `$${params.length}`));
  };
  if (filters.plate) {
    if (filters.plateMode === "exact") {
      add(`${PLATE_NORM_SQL} = ?`, normalizePlate(filters.plate));
    } else if (filters.plateMode === "fuzzy") {
      add(`${PLATE_OCR_SQL} LIKE '%' || ? || '%'`, ocrFoldPlate(filters.plate));
    } else {
      add(`${PLATE_NORM_SQL} LIKE '%' || ? || '%'`, normalizePlate(filters.plate));
    }
  }
  if (filters.plateExact) add(`${PLATE_NORM_SQL} = ?`, normalizePlate(filters.plateExact));
  if (filters.types && filters.types.length > 0) {
    add("v.vehicle_type = ANY(?::text[])", filters.types);
  } else if (filters.type) {
    add("v.vehicle_type = ?", filters.type);
  }
  if (filters.camera) add("v.camera_id = ?", filters.camera);
  if (filters.from) add("v.event_time >= ?::timestamptz", filters.from);
  if (filters.to) add("v.event_time < ?::timestamptz", filters.to);
  if (filters.colours && filters.colours.length > 0) {
    add("lower(COALESCE(v.colour, '')) = ANY(?::text[])", filters.colours);
  } else if (filters.colour) {
    add("lower(v.colour) = lower(?)", filters.colour);
  }
  if (filters.make) add("lower(COALESCE(v.make, '')) LIKE '%' || ? || '%'", filters.make.toLowerCase());
  if (filters.model) add("lower(COALESCE(v.model, '')) LIKE '%' || ? || '%'", filters.model.toLowerCase());
  if (filters.hasPlate !== undefined) add("v.has_plate = ?", filters.hasPlate);
  if (filters.minConfidence) add(`${PLATE_CONFIDENCE_SQL} >= ?`, filters.minConfidence);
  return { clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

export async function getDetectionsPage(input: DetectionQuery): Promise<Page<Detection>> {
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(input.pageSize)));
  const where = buildWhere(input);
  const totalResult = await query<Row>(`SELECT COUNT(*) AS total FROM public.v_events_dashboard v ${where.clause}`, where.params);
  const total = asNumber(totalResult.rows[0]?.total);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(input.page)), pageCount);
  const direction = input.dir === "asc" ? "ASC" : "DESC";
  const sortColumn = SORT_COLUMNS[input.sort] ?? SORT_COLUMNS.detectedAt;
  const limitIndex = where.params.length + 1;
  const rows = await query<Row>(
    `SELECT ${DETECTION_COLUMNS}
     FROM public.v_events_dashboard v
     LEFT JOIN public.cameras c ON c.camera_id = v.camera_id
     ${where.clause}
     ORDER BY ${sortColumn} ${direction} NULLS LAST, v.event_id DESC
     LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`,
    [...where.params, pageSize, (page - 1) * pageSize],
  );
  return { rows: rows.rows.map(rowToDetection), total, page, pageSize };
}

export async function getRecentDetections(limit: number): Promise<Detection[]> {
  const result = await getDetectionsPage({ page: 1, pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, limit)), sort: "detectedAt", dir: "desc" });
  return result.rows;
}

export async function getDetectionsByIds(ids: string[]): Promise<Detection[]> {
  if (ids.length === 0) return [];
  const result = await query<Row>(
    `SELECT ${DETECTION_COLUMNS}
     FROM public.v_events_dashboard v
     LEFT JOIN public.cameras c ON c.camera_id = v.camera_id
     WHERE v.event_id::text = ANY($1::text[])`,
    [ids],
  );
  return result.rows.map(rowToDetection);
}

export async function getDetectionById(eventId: string): Promise<Detection | null> {
  const rows = await getDetectionsByIds([eventId]);
  return rows[0] ?? null;
}

/**
 * Returns detections recorded strictly after `lastEventId` (ordered oldest-first) so a
 * reconnecting SSE client with `Last-Event-ID` can catch up without gaps.
 */
export async function getDetectionsAfterEventId(lastEventId: string, limit = 100): Promise<Detection[]> {
  const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)));
  const anchor = await query<Row>(
    "SELECT COALESCE(created_at, event_time) AS ts FROM public.events WHERE event_id = $1 LIMIT 1",
    [lastEventId],
  );
  const anchorTs = anchor.rows[0]?.ts ? iso(anchor.rows[0].ts) : null;
  if (!anchorTs) return [];

  const result = await query<Row>(
    `SELECT ${DETECTION_COLUMNS}
     FROM public.v_events_dashboard v
     JOIN public.events e ON e.event_id = v.event_id
     LEFT JOIN public.cameras c ON c.camera_id = v.camera_id
     WHERE (COALESCE(e.created_at, v.event_time) > $1::timestamptz)
        OR (COALESCE(e.created_at, v.event_time) = $1::timestamptz AND v.event_id > $2)
     ORDER BY COALESCE(e.created_at, v.event_time) ASC, v.event_id ASC
     LIMIT $3`,
    [anchorTs, lastEventId, safeLimit],
  );
  return result.rows.map(rowToDetection);
}

/**
 * Walks every matching detection in batches (keyset pagination on event_time, event_id) so an
 * export never holds more than one batch in memory.
 */
export async function* iterateDetections(filters: DetectionFilters, batchSize = 1000): AsyncGenerator<Detection[]> {
  const where = buildWhere(filters);
  const joiner = where.clause ? "AND" : "WHERE";
  let lastTime: string | null | undefined;
  let lastId = "";
  for (;;) {
    const params: unknown[] = [...where.params];
    let keyset = "";
    if (lastTime !== undefined) {
      if (lastTime === null) {
        params.push(lastId);
        keyset = `${joiner} v.event_time IS NULL AND v.event_id::text < $${params.length}`;
      } else {
        params.push(lastTime, lastId);
        keyset = `${joiner} (v.event_time < $${params.length - 1}::timestamptz OR v.event_time IS NULL OR (v.event_time = $${params.length - 1}::timestamptz AND v.event_id::text < $${params.length}))`;
      }
    }
    params.push(batchSize);
    const result = await query<Row>(
      `SELECT ${DETECTION_COLUMNS}
       FROM public.v_events_dashboard v
       LEFT JOIN public.cameras c ON c.camera_id = v.camera_id
       ${where.clause} ${keyset}
       ORDER BY v.event_time DESC NULLS LAST, v.event_id DESC
       LIMIT $${params.length}`,
      params,
    );
    if (result.rows.length === 0) return;
    yield result.rows.map(rowToDetection);
    const last = result.rows[result.rows.length - 1];
    lastTime = last.event_time ? iso(last.event_time) : null;
    lastId = String(last.event_id);
    if (result.rows.length < batchSize) return;
  }
}

export async function getColourOptions(): Promise<string[]> {
  const result = await query<Row>(
    `SELECT DISTINCT colour FROM public.v_events_dashboard WHERE colour IS NOT NULL AND colour <> '' ORDER BY colour LIMIT 60`,
  );
  return result.rows.map((row) => String(row.colour));
}

export interface FilteredSummary {
  total: number;
  withPlate: number;
  byType: Record<VehicleType, number>;
}

/** Aggregated counts for the assistant's `summary` intent — computed strictly in SQL. */
export async function getFilteredSummary(filters: DetectionFilters): Promise<FilteredSummary> {
  const where = buildWhere(filters);
  const [totalsRes, typesRes] = await Promise.all([
    query<Row>(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE v.has_plate) AS with_plate
       FROM public.v_events_dashboard v ${where.clause}`,
      where.params,
    ),
    query<Row>(
      `SELECT v.vehicle_type, COUNT(*) AS total
       FROM public.v_events_dashboard v ${where.clause}
       GROUP BY v.vehicle_type`,
      where.params,
    ),
  ]);
  const byType: Record<VehicleType, number> = {
    car: 0,
    rickshaw: 0,
    htv: 0,
    van: 0,
    pickup: 0,
    bike: 0,
  };
  for (const row of typesRes.rows) {
    const key = String(row.vehicle_type) as VehicleType;
    if (key in byType) {
      byType[key] = asNumber(row.total);
    }
  }
  return {
    total: asNumber(totalsRes.rows[0]?.total),
    withPlate: asNumber(totalsRes.rows[0]?.with_plate),
    byType,
  };
}

export async function getCameras(): Promise<Camera[]> {
  const result = await query<Row>(`
    SELECT c.camera_id, c.name, c.location, c.is_active, c.created_at,
      (SELECT MAX(e.event_time) FROM public.events e WHERE e.camera_id = c.camera_id) AS last_activity,
      (SELECT COUNT(*) FROM public.events e
        WHERE e.camera_id = c.camera_id AND e.event_time >= date_trunc('day', now())) AS detections_today
    FROM public.cameras c
    ORDER BY c.name`);
  const now = Date.now();
  return result.rows.map((row) => {
    const lastActivity = iso(row.last_activity || row.created_at);
    const age = lastActivity ? now - new Date(lastActivity).getTime() : Number.POSITIVE_INFINITY;
    const status: Camera["status"] = !row.is_active ? "offline" : age > 15 * 60 * 1000 ? "warning" : "online";
    return {
      id: String(row.camera_id),
      name: String(row.name || row.camera_id),
      location: String(row.location || "Location unavailable"),
      status,
      lastActivity,
      detectionsToday: asNumber(row.detections_today),
    };
  });
}

/** Vehicles (grouped by normalised plate) that have at least one event matching the filters. */
export async function getVehiclesPage(filters: DetectionFilters, page: number, pageSize: number): Promise<Page<Vehicle>> {
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(pageSize)));
  const where = buildWhere({ ...filters, hasPlate: undefined });
  const joiner = where.clause ? "AND" : "WHERE";
  const base = `
    WITH f AS (
      SELECT v.*, ${PLATE_NORM_SQL} AS plate_norm
      FROM public.v_events_dashboard v
      ${where.clause} ${joiner} v.has_plate
    )`;
  const totalResult = await query<Row>(`${base} SELECT COUNT(DISTINCT plate_norm) AS total FROM f WHERE plate_norm <> ''`, where.params);
  const total = asNumber(totalResult.rows[0]?.total);
  const current = Math.min(Math.max(1, Math.floor(page)), Math.max(1, Math.ceil(total / size)));
  const n = where.params.length;
  const result = await query<Row>(
    `${base}
     SELECT plate_norm,
       (array_agg(number_plate ORDER BY event_time DESC))[1] AS plate,
       (array_agg(vehicle_type ORDER BY event_time DESC))[1] AS vehicle_type,
       (array_agg(make ORDER BY event_time DESC) FILTER (WHERE make IS NOT NULL))[1] AS make,
       (array_agg(model ORDER BY event_time DESC) FILTER (WHERE model IS NOT NULL))[1] AS model,
       (array_agg(colour ORDER BY event_time DESC) FILTER (WHERE colour IS NOT NULL))[1] AS colour,
       COUNT(*) AS total_sightings,
       MIN(event_time) AS first_seen,
       MAX(event_time) AS last_seen,
       (array_agg(event_id ORDER BY event_time DESC))[1] AS latest_event_id,
       (array_agg(vehicle_key IS NOT NULL ORDER BY event_time DESC))[1] AS has_vehicle_image,
       (array_agg(plate_key IS NOT NULL ORDER BY event_time DESC))[1] AS has_plate_image
     FROM f WHERE plate_norm <> ''
     GROUP BY plate_norm
     ORDER BY MAX(event_time) DESC NULLS LAST, plate_norm
     LIMIT $${n + 1} OFFSET $${n + 2}`,
    [...where.params, size, (current - 1) * size],
  );
  const rows = result.rows.map<Vehicle>((row) => ({
    plate: String(row.plate ?? row.plate_norm),
    plateNorm: String(row.plate_norm),
    type: row.vehicle_type as VehicleType,
    make: [row.make, row.model].filter((part) => typeof part === "string" && part).join(" ") || null,
    color: typeof row.colour === "string" && row.colour ? row.colour : null,
    totalSightings: asNumber(row.total_sightings),
    firstSeen: iso(row.first_seen),
    lastSeen: iso(row.last_seen),
    latestEventId: String(row.latest_event_id),
    hasVehicleImage: Boolean(row.has_vehicle_image),
    hasPlateImage: Boolean(row.has_plate_image),
  }));
  return { rows, total, page: current, pageSize: size };
}

/** How often one vehicle was seen on each camera (aggregated in SQL). */
export async function getVehicleCameraBreakdown(plateNorm: string, filters: DetectionFilters): Promise<Array<{ cameraId: string; count: number }>> {
  const where = buildWhere({ ...filters, plate: undefined, plateExact: plateNorm });
  const result = await query<Row>(
    `SELECT v.camera_id, COUNT(*) AS total FROM public.v_events_dashboard v ${where.clause} GROUP BY v.camera_id ORDER BY total DESC LIMIT 50`,
    where.params,
  );
  return result.rows.map((row) => ({ cameraId: String(row.camera_id ?? ""), count: asNumber(row.total) }));
}

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getStatistics(): Promise<DetectionStatistics> {
  const conf = "(CASE WHEN number_plate_confidence <= 1 THEN number_plate_confidence * 100 ELSE number_plate_confidence END)";
  const [events, cameras] = await Promise.all([
    query<Row>(`
      SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE event_time >= date_trunc('day', now())) AS today,
        COUNT(*) FILTER (WHERE event_time >= date_trunc('day', now()) - interval '1 day'
                           AND event_time < now() - interval '1 day') AS yesterday_same_time,
        AVG(${conf}) FILTER (WHERE event_time >= now() - interval '7 days') AS accuracy_now,
        AVG(${conf}) FILTER (WHERE event_time >= now() - interval '14 days' AND event_time < now() - interval '7 days') AS accuracy_before
      FROM public.events`),
    query<Row>(`SELECT COUNT(*) AS total_cameras, COUNT(*) FILTER (WHERE is_active) AS active_cameras FROM public.cameras`),
  ]);
  const e = events.rows[0] ?? {};
  const c = cameras.rows[0] ?? {};
  const accuracyNow = e.accuracy_now === null || e.accuracy_now === undefined ? null : asNumber(e.accuracy_now);
  const accuracyBefore = e.accuracy_before === null || e.accuracy_before === undefined ? null : asNumber(e.accuracy_before);
  return {
    totalVehicles: asNumber(e.total),
    todayVehicles: asNumber(e.today),
    todayChange: percentChange(asNumber(e.today), asNumber(e.yesterday_same_time)),
    activeCameras: asNumber(c.active_cameras),
    totalCameras: asNumber(c.total_cameras),
    accuracy: Math.round((accuracyNow ?? 0) * 10) / 10,
    accuracyChange: accuracyNow !== null && accuracyBefore !== null ? Math.round((accuracyNow - accuracyBefore) * 10) / 10 : null,
  };
}

const hourLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: true, timeZone: "UTC" });

/** Detections per hour for the last 24 hours (UTC hours), grouped in SQL. */
export async function getActivitySeries(): Promise<TimeSeriesPoint[]> {
  const result = await query<Row>(`
    SELECT date_trunc('hour', event_time) AS hour, COUNT(*) AS detections
    FROM public.events
    WHERE event_time >= date_trunc('hour', now()) - interval '23 hours'
    GROUP BY 1`);
  const counts = new Map(result.rows.map((row) => [iso(row.hour).slice(0, 13), asNumber(row.detections)]));
  const currentHour = Math.floor(Date.now() / 3_600_000) * 3_600_000;
  return Array.from({ length: 24 }, (_, index) => {
    const date = new Date(currentHour - (23 - index) * 3_600_000);
    const key = date.toISOString().slice(0, 13);
    return { key, label: hourLabel.format(date), detections: counts.get(key) ?? 0 };
  });
}

function distributionFrom(rows: Row[]): DistributionPoint[] {
  const totals = new Map(rows.map((row) => [String(row.vehicle_type), asNumber(row.total)]));
  return VEHICLE_TYPES.map((name) => ({ name, value: totals.get(name) ?? 0 }));
}

/** Vehicle-type counts since `since` (ISO) or since the start of today (UTC day of the DB session). */
export async function getDistribution(since?: string): Promise<DistributionPoint[]> {
  const result = await query<Row>(
    `SELECT vehicle_type, COUNT(*) AS total FROM public.events
     WHERE event_time >= COALESCE($1::timestamptz, date_trunc('day', now()))
     GROUP BY vehicle_type`,
    [since ?? null],
  );
  return distributionFrom(result.rows);
}

const dayLabel = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
const IN_WINDOW = "event_time >= $1::timestamptz AND event_time < $2::timestamptz";
const ANALYTICS_CONF = "(CASE WHEN number_plate_confidence <= 1 THEN number_plate_confidence * 100 ELSE number_plate_confidence END)";
const DAY_MS = 86_400_000;

/** Window of the last `days` UTC days including today, as [startIso, endIso). */
export function trailingWindow(days: number): { from: string; to: string } {
  const span = Math.min(90, Math.max(1, Math.floor(days)));
  const tomorrow = (Math.floor(Date.now() / DAY_MS) + 1) * DAY_MS;
  return { from: new Date(tomorrow - span * DAY_MS).toISOString(), to: new Date(tomorrow).toISOString() };
}

/** Aggregates for [from, to) (ISO), at most 90 days. Everything is grouped in SQL. */
export async function getAnalytics(range: { from: string; to: string }): Promise<AnalyticsData> {
  const fromMs = Date.parse(range.from);
  const toMs = Math.max(Date.parse(range.to), fromMs + DAY_MS);
  const span = Math.min(90, Math.max(1, Math.round((toMs - fromMs) / DAY_MS)));
  const windowStart = toMs - span * DAY_MS;
  const window = [new Date(windowStart).toISOString(), new Date(toMs).toISOString()];
  const [daily, hourly, weekly, distribution, confidence, perCamera, cameras] = await Promise.all([
    query<Row>(`SELECT date_trunc('day', event_time) AS bucket, COUNT(*) AS total FROM public.events WHERE ${IN_WINDOW} GROUP BY 1`, window),
    query<Row>(`SELECT EXTRACT(HOUR FROM event_time AT TIME ZONE 'UTC')::int AS bucket, COUNT(*) AS total FROM public.events WHERE ${IN_WINDOW} GROUP BY 1`, window),
    query<Row>(`SELECT EXTRACT(DOW FROM event_time AT TIME ZONE 'UTC')::int AS bucket, COUNT(*) AS total FROM public.events WHERE ${IN_WINDOW} GROUP BY 1`, window),
    query<Row>(`SELECT vehicle_type, COUNT(*) AS total FROM public.events WHERE ${IN_WINDOW} GROUP BY vehicle_type`, window),
    query<Row>(
      `SELECT
         COUNT(*) FILTER (WHERE ${ANALYTICS_CONF} < 60) AS b0,
         COUNT(*) FILTER (WHERE ${ANALYTICS_CONF} >= 60 AND ${ANALYTICS_CONF} < 70) AS b1,
         COUNT(*) FILTER (WHERE ${ANALYTICS_CONF} >= 70 AND ${ANALYTICS_CONF} < 80) AS b2,
         COUNT(*) FILTER (WHERE ${ANALYTICS_CONF} >= 80 AND ${ANALYTICS_CONF} < 90) AS b3,
         COUNT(*) FILTER (WHERE ${ANALYTICS_CONF} >= 90) AS b4
       FROM public.events WHERE ${IN_WINDOW} AND number_plate_confidence IS NOT NULL`,
      window,
    ),
    query<Row>(
      `SELECT camera_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE has_plate) AS with_plate, AVG(${ANALYTICS_CONF}) AS accuracy
       FROM public.events WHERE ${IN_WINDOW} GROUP BY camera_id`,
      window,
    ),
    query<Row>(`SELECT camera_id, name FROM public.cameras ORDER BY name`),
  ]);

  const byDay = new Map(daily.rows.map((row) => [iso(row.bucket).slice(0, 10), asNumber(row.total)]));
  const byHour = new Map(hourly.rows.map((row) => [asNumber(row.bucket), asNumber(row.total)]));
  const byWeekday = new Map(weekly.rows.map((row) => [asNumber(row.bucket), asNumber(row.total)]));
  const hourlySeries: TimeSeriesPoint[] = Array.from({ length: 24 }, (_, hour) => ({
    label: `${String(hour).padStart(2, "0")}:00`,
    detections: byHour.get(hour) ?? 0,
  }));
  const trend: TimeSeriesPoint[] =
    span === 1
      ? hourlySeries
      : Array.from({ length: span }, (_, index) => {
          const date = new Date(windowStart + index * DAY_MS);
          return { label: dayLabel.format(date), detections: byDay.get(date.toISOString().slice(0, 10)) ?? 0 };
        });

  const stats = new Map(perCamera.rows.map((row) => [String(row.camera_id), row]));
  const cameraPerformance: CameraPerformance[] = cameras.rows.map((camera) => {
    const row = stats.get(String(camera.camera_id));
    const total = asNumber(row?.total);
    return {
      cameraId: String(camera.camera_id),
      name: String(camera.name || camera.camera_id),
      detections: total,
      plateRate: total ? (asNumber(row?.with_plate) / total) * 100 : 0,
      accuracy: asNumber(row?.accuracy),
    };
  });
  const buckets = confidence.rows[0] ?? {};

  return {
    trend,
    distribution: distributionFrom(distribution.rows),
    hourly: hourlySeries,
    weekly: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, day) => ({ label, detections: byWeekday.get(day) ?? 0 })),
    cameraPerformance,
    confidence: ["<60%", "60–69%", "70–79%", "80–89%", "90–100%"].map((range, index) => ({ range, count: asNumber(buckets[`b${index}`]) })),
    total: Array.from(byDay.values()).reduce((sum, value) => sum + value, 0),
  };
}

/** Recent watchlist matches formatted for the header notification bell on initial page load. */
export async function getNotifications(): Promise<AppNotification[]> {
  try {
    const result = await query<Row>(
      `SELECT v.event_id, v.number_plate, v.event_time, v.camera_id,
              c.name AS camera_name, c.location AS camera_location,
              w.plate_norm, w.note
       FROM public.v_events_dashboard v
       JOIN public.watchlist w ON w.plate_norm = ${PLATE_NORM_SQL}
       LEFT JOIN public.cameras c ON c.camera_id = v.camera_id
       WHERE v.has_plate
       ORDER BY v.event_time DESC NULLS LAST
       LIMIT 20`,
    );
    return result.rows.map((row) => {
      const plate = String(row.number_plate || row.plate_norm);
      const cameraName = String(row.camera_name || row.camera_id || "Unknown camera");
      const note = typeof row.note === "string" && row.note.trim() ? ` · ${row.note.trim()}` : "";
      return {
        id: `wl-${String(row.event_id)}`,
        title: `Watchlist match · ${plate}`,
        description: `${cameraName}${note}`,
        time: iso(row.event_time),
        tone: "danger" as const,
      };
    });
  } catch {
    return [];
  }
}
