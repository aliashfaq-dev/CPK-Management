import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faCarSide,
  faMotorcycle,
  faTaxi,
  faTruck,
  faTruckPickup,
  faVanShuttle,
} from "@fortawesome/free-solid-svg-icons";
import type { AppSettings, VehicleType } from "@/types";

export const VEHICLE_TYPES: VehicleType[] = ["car", "rickshaw", "htv", "van", "pickup", "bike"];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  car: "Car",
  rickshaw: "Rickshaw",
  htv: "HTV",
  van: "Van",
  pickup: "Pickup",
  bike: "Bike",
};

export function isVehicleType(value: unknown): value is VehicleType {
  return typeof value === "string" && (VEHICLE_TYPES as string[]).includes(value);
}

export const VEHICLE_TYPE_ICONS: Record<VehicleType, IconDefinition> = {
  car: faCarSide,
  rickshaw: faTaxi,
  htv: faTruck,
  van: faVanShuttle,
  pickup: faTruckPickup,
  bike: faMotorcycle,
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
  car: "#1B2A7B",
  rickshaw: "#DC2626",
  htv: "#6B7BD6",
  van: "#C5CCF0",
  pickup: "#475569",
  bike: "#94A3B8",
};

export const PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

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
};
