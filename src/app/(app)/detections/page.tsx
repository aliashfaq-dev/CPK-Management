import type { Metadata } from "next";
import { DetectionsView } from "@/components/detections/DetectionsView";
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
      <PageHeader description="Every vehicle recorded by your cameras. Search with Gemini AI, customize columns, sort, or open any record for full snapshot details." />
      <DetectionsView result={result} query={{ ...query, page: result.page }} />
    </>
  );
}
