import type { Metadata } from "next";
import { DetectionsView } from "@/components/detections/DetectionsView";
import { AssistantChat } from "@/components/ui/AssistantChat";
import { PageHeader } from "@/components/ui/PageHeader";
import { getDetectionsPage } from "@/lib/data-service";
import { parseDetectionQuery, type RawParams } from "@/lib/detection-query";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Detections" };

export default async function DetectionsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const query = parseDetectionQuery(await searchParams);
  const result = await getDetectionsPage(query);
  return (
    <>
      <PageHeader description="Every vehicle recorded by your cameras. Sort and open any record for full snapshot details." />
      <AssistantChat className="mb-4" title="Find a detection by asking" description="Ask in plain words, then open any result below to see it in the table." />
      <DetectionsView result={result} query={{ ...query, page: result.page }} />
    </>
  );
}
