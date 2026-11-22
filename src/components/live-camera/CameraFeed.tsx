import { faVideo, faVideoSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Camera, Detection } from "@/types";
import { cn } from "@/lib/utils";

interface CameraFeedProps {
  camera: Camera;
  detections: Detection[];
  showOverlay: boolean;
  fill?: boolean;
}

/** Placeholder frame with a mock detection overlay. Replace the body with a <video> element once a stream exists. */
export function CameraFeed({ camera, detections, showOverlay, fill = false }: CameraFeedProps) {
  const offline = camera.status === "offline";
  const seed = Number(camera.id.replace(/\D/g, "")) || 1;
  const shift = (seed * 7) % 12;
  const boxes = detections.slice(0, 2).map((detection, index) => ({
    detection,
    left: (index === 0 ? 14 : 56) + shift,
    top: (index === 0 ? 44 : 36) + (shift % 6),
    width: index === 0 ? 26 : 22,
    height: index === 0 ? 32 : 28,
  }));

  return (
    <div className={cn("relative w-full overflow-hidden bg-feed text-white", fill ? "h-full" : "aspect-video")}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/40">
        <FontAwesomeIcon icon={offline ? faVideoSlash : faVideo} className="text-2xl" />
        <span className="text-xs">{offline ? "No signal" : "Placeholder feed · no stream connected"}</span>
      </div>

      <span className="absolute left-2 top-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium">{camera.id}</span>
      <span
        className={cn(
          "absolute right-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-medium",
          offline ? "bg-danger text-white" : camera.status === "warning" ? "bg-warning text-fg" : "bg-white/10",
        )}
      >
        {offline ? "OFFLINE" : camera.status === "warning" ? "WEAK SIGNAL" : "DEMO"}
      </span>

      {showOverlay &&
        !offline &&
        boxes.map(({ detection, left, top, width, height }) => (
          <div
            key={detection.id}
            className="absolute border-2 border-danger"
            style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
          >
            <span className="absolute -top-5 -left-0.5 whitespace-nowrap bg-danger px-1.5 py-0.5 text-[10px] font-medium text-white">
              {detection.vehicleType} · {detection.plate} · {detection.confidence.toFixed(0)}%
            </span>
          </div>
        ))}
    </div>
  );
}
