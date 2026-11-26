import type { Metadata } from "next";
import { LiveCameraView } from "@/components/live-camera/LiveCameraView";
import { getCameras, getRecentDetections } from "@/lib/data-service";
import { isPipelineConfigured, listStreamsWithStatus } from "@/lib/pipeline";
import type { Camera } from "@/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live Camera" };

const LOOP_TEST_CAMERA: Camera = {
  id: "CAM-01",
  name: "Loop Test Camera",
  location: "Fallback preview (PIPELINE_URL not set)",
  status: "online",
  lastActivity: new Date().toISOString(),
  resolution: "1920 × 1080",
  fps: 30,
  detectionsToday: 0,
  streamUrl: "/stream.mp4",
};

export default async function LiveCameraPage() {
  const pipelineConfigured = isPipelineConfigured();
  const [databaseCameras, detections, streams] = await Promise.all([
    getCameras(),
    getRecentDetections(100),
    pipelineConfigured ? listStreamsWithStatus().catch(() => []) : Promise.resolve([]),
  ]);

  let cameras: Camera[];
  if (pipelineConfigured) {
    const streamByCamera = new Map(streams.map((stream) => [stream.camera_id, stream]));
    const seenCameras = new Set<string>();

    cameras = databaseCameras.map((camera) => {
      seenCameras.add(camera.id);
      const stream = streamByCamera.get(camera.id);
      if (!stream) return camera;
      const state = stream.status?.state ?? "stopped";
      return {
        ...camera,
        streamId: stream.id,
        streamState: state,
        fps: stream.status?.fps ?? 0,
        streamError: stream.status?.last_error ?? null,
        status: state === "running" ? "online" : state === "error" ? "warning" : "offline",
      };
    });

    for (const stream of streams) {
      if (seenCameras.has(stream.camera_id)) continue;
      const state = stream.status?.state ?? "stopped";
      cameras.push({
        id: stream.camera_id,
        name: stream.name,
        location: "Pipeline stream",
        status: state === "running" ? "online" : state === "error" ? "warning" : "offline",
        lastActivity: stream.status?.last_event ?? "",
        detectionsToday: stream.status?.events ?? 0,
        streamId: stream.id,
        streamState: state,
        fps: stream.status?.fps ?? 0,
        streamError: stream.status?.last_error ?? null,
      });
    }
  } else {
    // Fallback MP4 preview is used ONLY when PIPELINE_URL is empty.
    cameras =
      databaseCameras.length > 0
        ? databaseCameras.map((camera, index) =>
            index === 0 ? { ...camera, status: "online" as const, streamUrl: "/stream.mp4" } : camera,
          )
        : [LOOP_TEST_CAMERA];
  }

  return (
    <LiveCameraView
      cameras={cameras}
      detections={detections}
      pipelineConfigured={pipelineConfigured}
    />
  );
}
