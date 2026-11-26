/** The six vehicle classes the detection pipeline emits. "other" is never produced. */
export type VehicleType = "car" | "rickshaw" | "htv" | "van" | "pickup" | "bike";
export type CameraStatus = "online" | "offline" | "warning";
export type DateRangeKey = "today" | "7d" | "30d" | "custom";
export type SortDirection = "asc" | "desc";
export type DetectionSortKey =
  | "plate"
  | "vehicleType"
  | "cameraId"
  | "detectedAt"
  | "confidence";

/** A vehicle (grouped by normalised plate) in the Find Flag results. */
export interface Vehicle {
  plate: string;
  /** Normalised plate (uppercase A-Z0-9), the grouping key. */
  plateNorm: string;
  type: VehicleType;
  /** Make and model from the stage-2 analysis, or null until it has run. */
  make: string | null;
  color: string | null;
  totalSightings: number;
  firstSeen: string;
  lastSeen: string;
  /** Most recent event for this plate; used for the thumbnail. */
  latestEventId: string;
  hasVehicleImage: boolean;
  hasPlateImage: boolean;
}

export interface Detection {
  id: string;
  /** Plate text as read by the pipeline; empty string when no plate was read. */
  plate: string;
  hasPlate: boolean;
  /** Straight from events.vehicle_type. */
  vehicleType: VehicleType;
  /** Stage-2 make + model, or null until the analysis pipeline has filled `analysis`. */
  make: string | null;
  color: string | null;
  analysisStatus: string | null;
  cameraId: string;
  cameraName: string;
  location: string;
  detectedAt: string;
  /** Plate read confidence, 0-100. */
  confidence: number;
  /** Plate detector confidence, 0-100, or null. */
  plateDetectionConfidence: number | null;
  hasVehicleImage: boolean;
  hasPlateImage: boolean;
  /** Present on realtime SSE messages to distinguish stage-2 analysis updates from new rows. */
  type?: "insert" | "update";
}

export interface Camera {
  id: string;
  name: string;
  location: string;
  status: CameraStatus;
  lastActivity: string;
  detectionsToday: number;
  /** Placeholder metadata for the live-camera tiles (replaced by pipeline status in a later phase). */
  resolution?: string;
  fps?: number;
  /** Progressive video URL used only when no pipeline is configured. */
  streamUrl?: string;
  /** Pipeline stream id attached to this camera, if any. */
  streamId?: string;
}

export type UserRole = "admin" | "viewer";

/** The signed-in user as seen by the UI. */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
}

export interface DetectionStatistics {
  totalVehicles: number;
  todayVehicles: number;
  /** Percent change vs the same elapsed time yesterday; null when yesterday had no data. */
  todayChange: number | null;
  activeCameras: number;
  totalCameras: number;
  /** Average plate confidence over the last 7 days (0-100). */
  accuracy: number;
  /** Difference in points vs the 7 days before; null when there is no earlier data. */
  accuracyChange: number | null;
}

export interface TimeSeriesPoint {
  /** Optional stable bucket key (e.g. ISO hour `2026-11-26T09`) used for live increments. */
  key?: string;
  label: string;
  detections: number;
}

export interface DistributionPoint {
  name: VehicleType;
  value: number;
}

export interface CameraPerformance {
  cameraId: string;
  name: string;
  detections: number;
  /** Share of events where a plate was read, 0-100. */
  plateRate: number;
  /** Average plate confidence, 0-100. */
  accuracy: number;
}

export interface ConfidenceBucket {
  range: string;
  count: number;
}

export interface AnalyticsData {
  trend: TimeSeriesPoint[];
  distribution: DistributionPoint[];
  hourly: TimeSeriesPoint[];
  weekly: TimeSeriesPoint[];
  cameraPerformance: CameraPerformance[];
  confidence: ConfidenceBucket[];
  total: number;
}

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  tone: "info" | "warning" | "danger";
}

export interface AppSettings {
  appName: string;
  timeZone: string;
  dateFormat: string;
  language: string;
  minConfidence: number;
  vehicleDetection: boolean;
  plateDetection: boolean;
  detectionNotifications: boolean;
  emailNotifications: boolean;
  systemNotifications: boolean;
  detectionAlerts: boolean;
}

/** One Chrome-style workspace tab on the Live Camera page. An empty `cameraIds` means a blank "New View". */
export interface WorkspaceTab {
  id: string;
  title: string;
  cameraIds: string[];
  /** Pinned tabs (the "All cameras" home tab) cannot be closed. */
  pinned?: boolean;
}

/** Filters shared by the Detections table, CSV export, Find Flag and the assistant. */
export interface DetectionFilters {
  /** Substring of the plate (case, spaces and dashes ignored). */
  plate?: string;
  /** Exact normalised plate. */
  plateExact?: string;
  type?: VehicleType;
  camera?: string;
  /** Inclusive ISO timestamp. */
  from?: string;
  /** Exclusive ISO timestamp. */
  to?: string;
  colour?: string;
  hasPlate?: boolean;
  /** Minimum plate confidence, 0-100. */
  minConfidence?: number;
}

export interface DetectionQuery extends DetectionFilters {
  page: number;
  pageSize: number;
  sort: DetectionSortKey;
  dir: SortDirection;
}

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WatchlistEntry {
  id: string;
  plateNorm: string;
  note: string | null;
  createdAt: string;
}

export interface AlertRuleSettings {
  alertNoPlate: boolean;
  alertLowConfidence: boolean;
  lowConfidenceThreshold: number;
}

export interface LiveAlertPayload {
  id: string;
  severity: "high" | "medium" | "low";
  reason: string;
  createdAt: string;
  event: Detection;
}
