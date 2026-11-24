import type { Metadata } from "next";
import { FindFlagView } from "@/components/find-flag/FindFlagView";
import { AssistantChat } from "@/components/ui/AssistantChat";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCameras, getDetections, getVehicles } from "@/lib/data-service";

export const metadata: Metadata = { title: "Find Flag" };

export default async function FindFlagPage() {
  const [vehicles, detections, cameras] = await Promise.all([getVehicles(), getDetections(), getCameras()]);
  return (
    <>
      <PageHeader description="Locate a vehicle by plate, type, camera, or time range and review where it was detected." />
      <AssistantChat className="mb-6" title="Describe the vehicle you want to flag" description="Tell the assistant what you remember: part of the plate, color, type, camera, or time." />
      <FindFlagView vehicles={vehicles} detections={detections} cameras={cameras} />
    </>
  );
}
