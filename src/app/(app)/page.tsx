import { DashboardLiveView } from "@/components/dashboard/DashboardLiveView";
import {
  getActivitySeries,
  getCameras,
  getDistribution,
  getRecentDetections,
  getStatistics,
} from "@/lib/data-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, activity, distribution, recent, cameras] = await Promise.all([
    getStatistics(),
    getActivitySeries(),
    getDistribution(),
    getRecentDetections(6),
    getCameras(),
  ]);

  return (
    <DashboardLiveView
      initialStats={stats}
      initialActivity={activity}
      initialDistribution={distribution}
      initialRecent={recent}
      initialCameras={cameras}
    />
  );
}
