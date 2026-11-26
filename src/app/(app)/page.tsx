import { faBullseye, faCalendarDay, faCarSide, faVideo } from "@fortawesome/free-solid-svg-icons";
import { DeferredActivityChart } from "@/components/dashboard/DeferredActivityChart";
import { CameraStatusPanel } from "@/components/dashboard/CameraStatus";
import { DetectionOverview } from "@/components/dashboard/DetectionOverview";
import { RecentDetections } from "@/components/dashboard/RecentDetections";
import { StatCard, type StatChange } from "@/components/dashboard/StatCard";
import { AssistantChat } from "@/components/ui/AssistantChat";
import { ChartCard } from "@/components/ui/ChartCard";
import {
  getActivitySeries,
  getCameras,
  getDistribution,
  getRecentDetections,
  getStatistics,
} from "@/lib/data-service";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

function toChange(value: number | null, unit: string): StatChange | undefined {
  if (value === null) return undefined;
  return { text: `${Math.abs(value)}${unit}`, trend: value > 0 ? "up" : value < 0 ? "down" : "flat" };
}

export default async function DashboardPage() {
  const [stats, activity, distribution, recent, cameras] = await Promise.all([
    getStatistics(),
    getActivitySeries(),
    getDistribution(),
    getRecentDetections(6),
    getCameras(),
  ]);

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
