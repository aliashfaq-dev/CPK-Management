import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBus,
  faCarSide,
  faMotorcycle,
  faTruck,
} from "@fortawesome/free-solid-svg-icons";
import type { AppSettings, VehicleType } from "@/types";

export const VEHICLE_TYPES: VehicleType[] = ["Car", "Motorcycle", "Truck", "Bus"];

export const VEHICLE_TYPE_ICONS: Record<VehicleType, IconDefinition> = {
  Car: faCarSide,
  Motorcycle: faMotorcycle,
  Truck: faTruck,
  Bus: faBus,
};

/** Chart colors reference CSS variables so the theme stays in tokens.css. */
export const CHART_COLORS = {
  accent: "var(--accent)",
  grid: "var(--line)",
  axis: "var(--muted)",
  surface: "var(--surface)",
  cursor: "var(--subtle)",
} as const;

export const VEHICLE_TYPE_COLORS: Record<VehicleType, string> = {
  Car: "#1B2A7B",
  Motorcycle: "#DC2626",
  Truck: "#6B7BD6",
  Bus: "#C5CCF0",
};

export const PAGE_SIZE = 10;

export const DEFAULT_SETTINGS: AppSettings = {
  appName: "Community Policing Karachi",
  timeZone: "Asia/Karachi",
  dateFormat: "DD/MM/YYYY",
  language: "English",
  minConfidence: 85,
  vehicleDetection: true,
  plateDetection: true,
  detectionNotifications: true,
  emailNotifications: true,
  systemNotifications: true,
  detectionAlerts: false,
  profileName: "Ayesha Khan",
  profileEmail: "ayesha.khan@vehicleintel.example",
};
