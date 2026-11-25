import type { Metadata } from "next";
import { DetectionsView } from "@/components/detections/DetectionsView";
import { AssistantChat } from "@/components/ui/AssistantChat";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCameras, getDetections } from "@/lib/data-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Detections" };

export default async function DetectionsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [detections, cameras] = await Promise.all([getDetections(), getCameras()]);
  return (
    <>
      <PageHeader description="Every vehicle recorded by your cameras. Filter, sort, and open a record for full details." />
      <AssistantChat detections={detections} cameras={cameras} className="mb-4" title="Find a detection by asking" description="Ask in plain words, then open any result below to see it in the table." />
      <DetectionsView key={q ?? ""} detections={detections} cameras={cameras} initialQuery={q ?? ""} />
    </>
  );
}
