import type { Metadata } from "next";
import { DeferredAnalyticsView } from "@/components/analytics/DeferredAnalyticsView";
import { AssistantChat } from "@/components/ui/AssistantChat";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAnalytics, trailingWindow } from "@/lib/data-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const analytics = await getAnalytics(trailingWindow(7));
  return (
    <>
      <PageHeader description="Trends, vehicle mix, and camera performance over the period you choose." />
      <AssistantChat
        className="mb-6"
        title="Ask AI about trends, counts, or top plates"
        description='Try "summary is hafte", "kis camera par sab se zyada gaariyan", or "top plates today".'
      />
      <DeferredAnalyticsView initialData={analytics} />
    </>
  );
}
