import { formatTime } from "@/lib/formatTime";
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

/** Fixed "now" so server and client always render the same dummy data. */
export const BASE_TIME = Date.parse("2026-11-22T09:30:00Z");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const minutesAgo = (minutes: number) => new Date(BASE_TIME - minutes * MINUTE).toISOString();

export const currentUser: User = {
  id: "usr-001",
  name: "Ayesha Khan",
  email: "ayesha.khan@vehicleintel.example",
  role: "Operations Lead",
  initials: "AK",
};

export const cameras: Camera[] = [
  { id: "CAM-01", name: "Karsaz Junction", location: "Shahrah-e-Faisal, Karsaz", status: "online", lastActivity: minutesAgo(1), resolution: "1920×1080", fps: 30, detectionsToday: 214 },
  { id: "CAM-02", name: "Clifton Bridge", location: "Do Talwar, Clifton", status: "online", lastActivity: minutesAgo(2), resolution: "1920×1080", fps: 30, detectionsToday: 187 },
  { id: "CAM-03", name: "Korangi Checkpoint", location: "Korangi Road, Sector 24", status: "warning", lastActivity: minutesAgo(14), resolution: "1280×720", fps: 15, detectionsToday: 96 },
  { id: "CAM-04", name: "Gulshan Roundabout", location: "Gulshan-e-Iqbal, Block 13", status: "online", lastActivity: minutesAgo(1), resolution: "2560×1440", fps: 25, detectionsToday: 231 },
  { id: "CAM-05", name: "Port Qasim Gate", location: "Port Qasim Entrance", status: "offline", lastActivity: minutesAgo(412), resolution: "1920×1080", fps: 0, detectionsToday: 0 },
  { id: "CAM-06", name: "Northern Bypass", location: "Northern Bypass, Toll Plaza", status: "online", lastActivity: minutesAgo(3), resolution: "1920×1080", fps: 30, detectionsToday: 168 },
  { id: "CAM-07", name: "Saddar Junction", location: "Abdullah Haroon Road", status: "online", lastActivity: minutesAgo(1), resolution: "1920×1080", fps: 25, detectionsToday: 203 },
  { id: "CAM-08", name: "Airport Road", location: "Jinnah Terminal Approach", status: "warning", lastActivity: minutesAgo(9), resolution: "1280×720", fps: 20, detectionsToday: 112 },
];

interface PoolEntry {
  plate: string;
  type: VehicleType;
  make: string;
  color: string;
}

const vehiclePool: PoolEntry[] = [
  { plate: "BKL-2847", type: "Car", make: "Toyota Corolla", color: "White" },
  { plate: "ARZ-9013", type: "Car", make: "Honda Civic", color: "Silver" },
  { plate: "KTN-5526", type: "Car", make: "Suzuki Cultus", color: "Black" },
  { plate: "BDE-1190", type: "Car", make: "Hyundai Tucson", color: "Grey" },
  { plate: "AXM-7342", type: "Car", make: "Kia Sportage", color: "Blue" },
  { plate: "LRQ-6608", type: "Car", make: "Toyota Yaris", color: "Red" },
  { plate: "BNP-3375", type: "Car", make: "Honda City", color: "White" },
  { plate: "AGH-8864", type: "Car", make: "Suzuki Alto", color: "Silver" },
  { plate: "KMD-4417", type: "Car", make: "Toyota Fortuner", color: "Black" },
  { plate: "BCT-2096", type: "Car", make: "MG HS", color: "White" },
  { plate: "ALR-5731", type: "Car", make: "Changan Alsvin", color: "Grey" },
  { plate: "KSF-1288", type: "Car", make: "Honda BR-V", color: "Blue" },
  { plate: "KDL-3092", type: "Motorcycle", make: "Honda CG 125", color: "Red" },
  { plate: "KNB-6154", type: "Motorcycle", make: "Yamaha YBR 125", color: "Black" },
  { plate: "KPR-8820", type: "Motorcycle", make: "Honda CD 70", color: "Blue" },
  { plate: "KRV-2467", type: "Motorcycle", make: "Suzuki GS 150", color: "Grey" },
  { plate: "TKA-9132", type: "Truck", make: "Hino 500", color: "Blue" },
  { plate: "TLM-4408", type: "Truck", make: "Isuzu NPR", color: "White" },
  { plate: "TPX-7285", type: "Truck", make: "Mazda T3500", color: "Green" },
  { plate: "PSB-5589", type: "Bus", make: "Yutong ZK6", color: "White" },
  { plate: "PBK-1742", type: "Bus", make: "Higer KLQ", color: "White" },
];

const reportingCameras = cameras.filter((camera) => camera.status !== "offline");

function buildDetections(): Detection[] {
  const rand = createRng(20261122);
  const total = 72;
  return Array.from({ length: total }, (_, index) => {
    const vehicle = vehiclePool[Math.floor(rand() * vehiclePool.length)];
    const camera = reportingCameras[Math.floor(rand() * reportingCameras.length)];
    const offsetMinutes = index * 23 + Math.floor(rand() * 10);
    return {
      id: `DET-${9000 - index}`,
      plate: vehicle.plate,
      vehicleType: vehicle.type,
      make: vehicle.make,
      color: vehicle.color,
      cameraId: camera.id,
      cameraName: camera.name,
      location: camera.location,
      detectedAt: minutesAgo(offsetMinutes),
      confidence: Math.round((82 + rand() * 17.8) * 10) / 10,
    };
  });
}

export const detections: Detection[] = buildDetections();

export const vehicles: Vehicle[] = vehiclePool
  .map((entry) => {
    const sightings = detections.filter((d) => d.plate === entry.plate);
    return {
      plate: entry.plate,
      type: entry.type,
      make: entry.make,
      color: entry.color,
      totalSightings: sightings.length,
      firstSeen: sightings[sightings.length - 1]?.detectedAt ?? "",
      lastSeen: sightings[0]?.detectedAt ?? "",
    };
  })
  .filter((vehicle) => vehicle.totalSightings > 0);

export const statistics: DetectionStatistics = {
  totalVehicles: 128430,
  totalChange: 8.2,
  todayVehicles: 1284,
  todayChange: 4.6,
  activeCameras: cameras.filter((camera) => camera.status !== "offline").length,
  totalCameras: cameras.length,
  activeCamerasChange: -1,
  accuracy: 96.8,
  accuracyChange: 0.7,
};

export const notifications: AppNotification[] = [
  { id: "n1", title: "Camera offline", description: "CAM-05 Port Qasim Gate stopped reporting.", time: "7 hours ago", tone: "danger" },
  { id: "n2", title: "Weak signal", description: "CAM-03 Korangi Checkpoint is dropping frames.", time: "14 minutes ago", tone: "warning" },
  { id: "n3", title: "Low confidence detection", description: "DET-8994 was recorded at 82.4% confidence.", time: "1 hour ago", tone: "info" },
  { id: "n4", title: "Daily report ready", description: "Yesterday's detection summary is available.", time: "Today, 06:00 AM", tone: "info" },
];

function hourlyCurve(rand: () => number): TimeSeriesPoint[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    label: formatTime(new Date(Date.UTC(2026, 0, 1, hour))),
    detections: Math.round(
      18 +
        92 * Math.exp(-((hour - 8.5) ** 2) / 8) +
        112 * Math.exp(-((hour - 17.5) ** 2) / 10) +
        rand() * 12,
    ),
  }));
}

export function buildActivitySeries(): TimeSeriesPoint[] {
  return hourlyCurve(createRng(77));
}

const DISTRIBUTION_SHARES: Record<VehicleType, number> = {
  Car: 0.58,
  Motorcycle: 0.19,
  Truck: 0.14,
  Bus: 0.09,
};

export function buildDistribution(total: number): DistributionPoint[] {
  return (Object.keys(DISTRIBUTION_SHARES) as VehicleType[]).map((name) => ({
    name,
    value: Math.round(total * DISTRIBUTION_SHARES[name]),
  }));
}

const dayLabel = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

export function buildAnalytics(days: number): AnalyticsData {
  const span = Math.max(1, Math.min(90, Math.round(days)));
  const rand = createRng(1000 + span);

  const trend: TimeSeriesPoint[] =
    span === 1
      ? hourlyCurve(rand)
      : Array.from({ length: span }, (_, index) => {
          const date = new Date(BASE_TIME - (span - 1 - index) * DAY);
          const weekend = date.getUTCDay() === 5 || date.getUTCDay() === 6;
          return {
            label: dayLabel.format(date),
            detections: Math.round((weekend ? 900 : 1250) + rand() * 260),
          };
        });

  const total = trend.reduce((sum, point) => sum + point.detections, 0);
  const weekdayBase = [1320, 1290, 1350, 1410, 1480, 980, 860];
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const shares = [0.03, 0.08, 0.22, 0.37, 0.3];
  const buckets = ["Below 85%", "85–90%", "90–95%", "95–98%", "98–100%"];

  return {
    trend,
    distribution: buildDistribution(total),
    hourly: hourlyCurve(createRng(55)),
    weekly: weekdays.map((label, index) => ({
      label,
      detections: Math.round(weekdayBase[index] * (0.95 + rand() * 0.1)),
    })),
    cameraPerformance: cameras.map((camera) => ({
      cameraId: camera.id,
      name: camera.name,
      detections: Math.round(camera.detectionsToday * span * (0.9 + rand() * 0.2)),
      uptime:
        camera.status === "online"
          ? Math.round((99 + rand() * 0.9) * 10) / 10
          : camera.status === "warning"
            ? Math.round((93 + rand() * 3) * 10) / 10
            : 38.5,
      accuracy: Math.round((94 + rand() * 4) * 10) / 10,
    })),
    confidence: buckets.map((range, index) => ({
      range,
      count: Math.round(total * shares[index]),
    })),
  };
}
