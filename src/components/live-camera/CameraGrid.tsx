import { memo } from "react";
import type { Camera, Detection } from "@/types";
import { cn } from "@/lib/utils";
import { CameraCard } from "./CameraCard";

export const GRID_SIZES = [1, 2, 4, 6, 9] as const;
export type GridSize = (typeof GRID_SIZES)[number];

/** Most cameras one screen can show. */
export const MAX_GRID_SIZE = 9;

/** Static class strings so Tailwind can see them. Rows use minmax(0,1fr) so cards never push the page taller. */
const GRID_CLASSES: Record<GridSize, string> = {
  1: "grid-cols-1 grid-rows-1",
  2: "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1",
  4: "grid-cols-1 grid-rows-4 sm:grid-cols-2 sm:grid-rows-2",
  6: "grid-cols-2 grid-rows-3 lg:grid-cols-3 lg:grid-rows-2",
  9: "grid-cols-2 grid-rows-5 lg:grid-cols-3 lg:grid-rows-3",
};

/** Smallest supported grid that holds `count` cameras. */
export function fitGridSize(count: number): GridSize {
  return GRID_SIZES.find((size) => size >= count) ?? 9;
}

interface CameraGridProps {
  cameras: Camera[];
  detectionsByCamera: ReadonlyMap<string, Detection[]>;
  size: GridSize;
  showOverlay: boolean;
  active: boolean;
  onFullscreen: (id: string) => void;
}

const NO_DETECTIONS: Detection[] = [];

/** Only the cameras passed in are mounted, so anything filtered out or on another tab has no feed running. */
function CameraGridComponent({ cameras, detectionsByCamera, size, showOverlay, active, onFullscreen }: CameraGridProps) {
  return (
    <div className={cn("grid h-full min-h-0 gap-3", GRID_CLASSES[size])}>
      {cameras.map((camera) => (
        <CameraCard
          key={camera.id}
          camera={camera}
          detections={detectionsByCamera.get(camera.id) ?? NO_DETECTIONS}
          showOverlay={showOverlay}
          active={active}
          compact={size >= 6}
          onFullscreen={onFullscreen}
        />
      ))}
    </div>
  );
}

export const CameraGrid = memo(CameraGridComponent);
