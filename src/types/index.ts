export type VehicleType = "Car" | "Motorcycle" | "Truck" | "Bus";
export type CameraStatus = "online" | "offline" | "warning";
export type DateRangeKey = "today" | "7d" | "30d" | "custom";
export type SortDirection = "asc" | "desc";
export type DetectionSortKey =
  | "plate"
  | "vehicleType"
  | "cameraId"
  | "detectedAt"
  | "confidence";

export interface Vehicle {
  plate: string;
  type: VehicleType;
  make: string;
  color: string;
  totalSightings: number;
  firstSeen: string;
  lastSeen: string;
}

export interface Detection {
  id: string;
  plate: string;
  vehicleType: VehicleType;
  make: string;
  color: string;
  cameraId: string;
  cameraName: string;
  location: string;
  detectedAt: string;
  confidence: number;
}

export interface Camera {
  id: string;
  name: string;
  location: string;
  status: CameraStatus;
  lastActivity: string;
  resolution: string;
  fps: number;
  detectionsToday: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  initials: string;
}

export interface DetectionStatistics {
  totalVehicles: number;
  totalChange: number;
  todayVehicles: number;
  todayChange: number;
  activeCameras: number;
  totalCameras: number;
  activeCamerasChange: number;
  accuracy: number;
  accuracyChange: number;
}

export interface TimeSeriesPoint {
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
  uptime: number;
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
  profileName: string;
  profileEmail: string;
}
