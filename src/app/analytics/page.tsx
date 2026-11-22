import type { Metadata } from "next";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader description="Trends, vehicle mix, and camera performance over the period you choose." />
      <AnalyticsView />
    </>
  );
}
