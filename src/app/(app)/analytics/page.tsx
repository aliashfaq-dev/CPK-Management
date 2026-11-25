import type { Metadata } from "next";
import { DeferredAnalyticsView } from "@/components/analytics/DeferredAnalyticsView";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAnalytics } from "@/lib/data-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const analytics = await getAnalytics(90);
  return (
    <>
      <PageHeader description="Trends, vehicle mix, and camera performance over the period you choose." />
      <DeferredAnalyticsView initialData={analytics} />
    </>
  );
}
