import { memo } from "react";
import { faExpand } from "@fortawesome/free-solid-svg-icons";
import type { Camera, Detection } from "@/types";
import { Button } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/StatusBadge";
import { CameraFeed } from "./CameraFeed";

interface CameraCardProps {
  camera: Camera;
  detections: Detection[];
  showOverlay: boolean;
  active: boolean;
  compact: boolean;
  onFullscreen: (id: string) => void;
}

function CameraCardComponent({ camera, detections, showOverlay, active, compact, onFullscreen }: CameraCardProps) {
  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface">
      {/* Clicking anywhere on the feed opens fullscreen; keyboard users use the expand button below. */}
      <div className="min-h-0 flex-1 cursor-pointer" onClick={() => onFullscreen(camera.id)}>
        <CameraFeed camera={camera} detections={detections} showOverlay={showOverlay} active={active} fill />
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{camera.name}</p>
          {!compact && <p className="truncate text-xs text-muted">{camera.location}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {camera.streamId ? (
            <Badge
              tone={
                camera.streamState === "running"
                  ? "success"
                  : camera.streamState === "error"
                    ? "danger"
                    : "neutral"
              }
              dot
            >
              {camera.streamState ?? "stopped"}
              {camera.streamState === "running" && camera.fps ? ` · ${camera.fps.toFixed(0)} fps` : ""}
            </Badge>
          ) : (
            <StatusBadge status={camera.status} />
          )}
          <Button variant="ghost" size="icon" icon={faExpand} aria-label={`Open ${camera.name} fullscreen`} onClick={() => onFullscreen(camera.id)} />
        </div>
      </div>
    </article>
  );
}

export const CameraCard = memo(CameraCardComponent);
