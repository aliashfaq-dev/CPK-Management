"use client";

import type { Camera, Detection } from "@/types";
import { Badge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { CameraFeed } from "./CameraFeed";

interface FullscreenCameraModalProps {
  camera: Camera;
  detections: Detection[];
  showOverlay: boolean;
  onClose: () => void;
}

export function FullscreenCameraModal({ camera, detections, showOverlay, onClose }: FullscreenCameraModalProps) {
  const state = camera.streamState;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-feed p-3 text-white sm:p-4" role="dialog" aria-modal="true" aria-label={`${camera.name} fullscreen view`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{camera.name}</p>
            {camera.streamId && state && (
              <Badge tone={state === "running" ? "success" : state === "error" ? "danger" : "neutral"} dot>
                {state}{camera.fps ? ` · ${camera.fps.toFixed(1)} fps` : ""}
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-white/60">
            {camera.id} · {camera.location}{camera.streamId ? ` · Stream ${camera.streamId}` : ""}
          </p>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Exit fullscreen
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <CameraFeed camera={camera} detections={detections} showOverlay={showOverlay} active fill />
      </div>
    </div>
  );
}
