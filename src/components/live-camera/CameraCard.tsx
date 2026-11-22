import { faExpand } from "@fortawesome/free-solid-svg-icons";
import type { Camera, Detection } from "@/types";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { CameraFeed } from "./CameraFeed";

interface CameraCardProps {
  camera: Camera;
  detections: Detection[];
  selected: boolean;
  showOverlay: boolean;
  onSelect: () => void;
  onFullscreen: () => void;
}

export function CameraCard({ camera, detections, selected, showOverlay, onSelect, onFullscreen }: CameraCardProps) {
  return (
    <article className={cn("overflow-hidden rounded-lg border bg-surface", selected ? "border-accent ring-1 ring-accent" : "border-line")}>
      <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={`Select ${camera.name}`} className="block w-full">
        <CameraFeed camera={camera} detections={detections} showOverlay={showOverlay} />
      </button>
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{camera.name}</p>
          <p className="truncate text-xs text-muted">{camera.location}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge status={camera.status} />
          <Button variant="ghost" size="icon" icon={faExpand} aria-label={`Open ${camera.name} fullscreen`} onClick={onFullscreen} />
        </div>
      </div>
    </article>
  );
}
