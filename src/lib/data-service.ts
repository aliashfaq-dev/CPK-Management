/**
 * Data access layer. Every function is async and returns typed data, so the
 * dummy implementations can later be swapped for fetch() calls to a real API
 * without changing any UI code.
 */
import {
  buildActivitySeries,
  buildAnalytics,
  buildDistribution,
  cameras,
  currentUser,
  detections,
  notifications,
  statistics,
  vehicles,
} from "@/data/mock-data";
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
} from "@/types";

export async function getStatistics(): Promise<DetectionStatistics> {
  return statistics;
}

export async function getDetections(): Promise<Detection[]> {
  return detections;
}

export async function getRecentDetections(limit: number): Promise<Detection[]> {
  return detections.slice(0, limit);
}

export async function getCameras(): Promise<Camera[]> {
  return cameras;
}

export async function getVehicles(): Promise<Vehicle[]> {
  return vehicles;
}

export async function getActivitySeries(): Promise<TimeSeriesPoint[]> {
  return buildActivitySeries();
}

export async function getDistribution(): Promise<DistributionPoint[]> {
  return buildDistribution(statistics.todayVehicles);
}

export async function getAnalytics(days: number): Promise<AnalyticsData> {
  return buildAnalytics(days);
}

export async function getNotifications(): Promise<AppNotification[]> {
  return notifications;
}

export async function getCurrentUser(): Promise<User> {
  return currentUser;
}
