import { faBullseye, faCalendarDay, faCarSide, faVideo } from "@fortawesome/free-solid-svg-icons";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { CameraStatusPanel } from "@/components/dashboard/CameraStatus";
import { DetectionOverview } from "@/components/dashboard/DetectionOverview";
import { RecentDetections } from "@/components/dashboard/RecentDetections";
import { StatCard } from "@/components/dashboard/StatCard";
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
      <DashboardHero />
      <AssistantChat className="mb-4" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total vehicles detected" value={formatNumber(stats.totalVehicles)} icon={faCarSide} change={`${stats.totalChange}%`} trend="up" comparison="vs last month" />
        <StatCard label="Vehicles detected today" value={formatNumber(stats.todayVehicles)} icon={faCalendarDay} change={`${stats.todayChange}%`} trend="up" comparison="vs yesterday" />
        <StatCard label="Active cameras" value={`${stats.activeCameras} of ${stats.totalCameras}`} icon={faVideo} change={`${Math.abs(stats.activeCamerasChange)} camera`} trend="down" comparison="vs last week" />
        <StatCard label="Detection accuracy" value={`${stats.accuracy}%`} icon={faBullseye} change={`${stats.accuracyChange} pts`} trend="up" comparison="vs last month" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Detection activity" description="Vehicles detected per hour, last 24 hours">
          <ActivityChart data={activity} />
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
