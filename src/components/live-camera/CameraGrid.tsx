import type { Camera, Detection } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { CameraCard } from "./CameraCard";

interface CameraGridProps {
  cameras: Camera[];
  detections: Detection[];
  selectedId: string;
  showOverlay: boolean;
  onSelect: (id: string) => void;
  onFullscreen: (id: string) => void;
}

export function CameraGrid({ cameras, detections, selectedId, showOverlay, onSelect, onFullscreen }: CameraGridProps) {
  if (cameras.length === 0) {
    return <EmptyState title="No cameras match this filter" description="Choose a different status to see more cameras." />;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
      {cameras.map((camera) => (
        <CameraCard
          key={camera.id}
          camera={camera}
          detections={detections.filter((d) => d.cameraId === camera.id)}
          selected={camera.id === selectedId}
          showOverlay={showOverlay}
          onSelect={() => onSelect(camera.id)}
          onFullscreen={() => onFullscreen(camera.id)}
        />
      ))}
    </div>
  );
}
