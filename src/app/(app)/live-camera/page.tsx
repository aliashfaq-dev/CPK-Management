import type { Metadata } from "next";
import { LiveCameraView } from "@/components/live-camera/LiveCameraView";
import { getCameras, getDetections } from "@/lib/data-service";
import type { Camera } from "@/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live Camera" };

const LOOP_TEST_CAMERA: Camera = {
  id: "CAM-01",
  name: "Loop Test Camera",
  location: "AI/ML Test Area",
  status: "online",
  lastActivity: new Date().toISOString(),
  resolution: "1920 × 1080",
  fps: 30,
  detectionsToday: 0,
  streamUrl: "/stream.mp4",
};

export default async function LiveCameraPage() {
  const [databaseCameras, detections] = await Promise.all([getCameras(), getDetections()]);
  // Always provide a browser-playable test feed. If Neon already has cameras,
  // attach the local MP4 to the first camera card instead of leaving every card
  // as a placeholder (the current camera schema has no stream_url column).
  const cameras = databaseCameras.length > 0
    ? databaseCameras.map((camera, index) =>
        index === 0
          ? {
              ...camera,
              status: "online" as const,
              resolution: "1920 × 1080",
              fps: 30,
              streamUrl: camera.streamUrl || "/stream.mp4",
            }
          : camera,
      )
    : [LOOP_TEST_CAMERA];

  return <LiveCameraView cameras={cameras} detections={detections} />;
}
