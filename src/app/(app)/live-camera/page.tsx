import type { Metadata } from "next";
import { LiveCameraView } from "@/components/live-camera/LiveCameraView";
import { getCameras, getDetections } from "@/lib/data-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live Camera" };

export default async function LiveCameraPage() {
  const [cameras, detections] = await Promise.all([getCameras(), getDetections()]);
  return <LiveCameraView cameras={cameras} detections={detections} />;
}
