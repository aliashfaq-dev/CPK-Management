import type { Metadata } from "next";
import { LiveCameraView } from "@/components/live-camera/LiveCameraView";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCameras, getDetections } from "@/lib/data-service";

export const metadata: Metadata = { title: "Live Camera" };

export default async function LiveCameraPage() {
  const [cameras, detections] = await Promise.all([getCameras(), getDetections()]);
  return (
    <>
      <PageHeader description="Monitor every camera in one place. Feeds are placeholders until a video stream is connected." />
      <LiveCameraView cameras={cameras} detections={detections} />
    </>
  );
}
