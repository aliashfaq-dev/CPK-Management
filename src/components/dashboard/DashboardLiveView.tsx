"use client";

import { useState } from "react";
import { faBullseye, faCalendarDay, faCarSide, faVideo } from "@fortawesome/free-solid-svg-icons";
import type {
  Camera,
  Detection,
  DetectionStatistics,
  DistributionPoint,
  TimeSeriesPoint,
} from "@/types";
import { DeferredActivityChart } from "@/components/dashboard/DeferredActivityChart";
import { CameraStatusPanel } from "@/components/dashboard/CameraStatus";
import { DetectionOverview } from "@/components/dashboard/DetectionOverview";
import { RecentDetections } from "@/components/dashboard/RecentDetections";
import { StatCard, type StatChange } from "@/components/dashboard/StatCard";
import { AssistantChat } from "@/components/ui/AssistantChat";
import { ChartCard } from "@/components/ui/ChartCard";
import { useLiveDetectionSubscription } from "@/hooks/useLiveEvents";
import { formatNumber } from "@/lib/utils";

interface DashboardLiveViewProps {
  initialStats: DetectionStatistics;
  initialActivity: TimeSeriesPoint[];
  initialDistribution: DistributionPoint[];
  initialRecent: Detection[];
  initialCameras: Camera[];
}

function toChange(value: number | null, unit: string): StatChange | undefined {
  if (value === null) return undefined;
  return { text: `${Math.abs(value)}${unit}`, trend: value > 0 ? "up" : value < 0 ? "down" : "flat" };
}

export function DashboardLiveView({
  initialStats,
  initialActivity,
  initialDistribution,
  initialRecent,
  initialCameras,
}: DashboardLiveViewProps) {
  const [stats, setStats] = useState(initialStats);
  const [activity, setActivity] = useState(initialActivity);
  const [distribution, setDistribution] = useState(initialDistribution);
  const [recent, setRecent] = useState(initialRecent);
  const [cameras, setCameras] = useState(initialCameras);

  useLiveDetectionSubscription(({ detection, isUpdate }) => {
    if (isUpdate) {
      setRecent((current) =>
        current.map((item) => (item.id === detection.id ? detection : item)),
      );
      return;
    }

    setRecent((current) => {
      if (current.some((item) => item.id === detection.id)) return current;
      return [detection, ...current].slice(0, 6);
    });

    setStats((current) => ({
      ...current,
      totalVehicles: current.totalVehicles + 1,
      todayVehicles: current.todayVehicles + 1,
    }));

    const hourKey = (detection.detectedAt || new Date().toISOString()).slice(0, 13);
    setActivity((current) =>
      current.map((point, index) =>
        point.key === hourKey || (!point.key && index === current.length - 1)
          ? { ...point, detections: point.detections + 1 }
          : point,
      ),
    );

    setDistribution((current) =>
      current.map((item) =>
        item.name === detection.vehicleType ? { ...item, value: item.value + 1 } : item,
      ),
    );

    if (detection.cameraId) {
      setCameras((current) =>
        current.map((camera) =>
          camera.id === detection.cameraId
            ? {
                ...camera,
                status: "online",
                lastActivity: detection.detectedAt || new Date().toISOString(),
                detectionsToday: camera.detectionsToday + 1,
              }
            : camera,
        ),
      );
    }
  });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total vehicles detected" value={formatNumber(stats.totalVehicles)} icon={faCarSide} note="All recorded detections" />
        <StatCard label="Vehicles detected today" value={formatNumber(stats.todayVehicles)} icon={faCalendarDay} change={toChange(stats.todayChange, "%")} comparison="vs same time yesterday" />
        <StatCard label="Active cameras" value={`${stats.activeCameras} of ${stats.totalCameras}`} icon={faVideo} note="Cameras marked active" />
        <StatCard label="Plate read confidence" value={`${stats.accuracy}%`} icon={faBullseye} change={toChange(stats.accuracyChange, " pts")} comparison="vs previous 7 days" note="Average over the last 7 days" />
      </div>

      <AssistantChat className="mt-4" />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Detection activity" description="Vehicles detected per hour, last 24 hours (UTC)">
          <DeferredActivityChart data={activity} />
        </ChartCard>
        <DetectionOverview distribution={distribution} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <RecentDetections detections={recent} />
        </div>
        <CameraStatusPanel cameras={cameras} />
      </div>
    </>
  );
}
