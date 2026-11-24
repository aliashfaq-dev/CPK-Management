import type { Metadata } from "next";
import { DeferredAnalyticsView } from "@/components/analytics/DeferredAnalyticsView";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader description="Trends, vehicle mix, and camera performance over the period you choose." />
      <DeferredAnalyticsView />
    </>
  );
}
