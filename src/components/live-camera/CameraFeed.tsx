import { memo, useMemo, useRef } from "react";
import { faPause, faVideo, faVideoSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Camera, Detection } from "@/types";
import { useLiveStream } from "@/hooks/useLiveStream";
import { cn } from "@/lib/utils";

interface CameraFeedProps {
  camera: Camera;
  detections: Detection[];
  showOverlay: boolean;
  /** When false the stream is stopped and released (hidden tab, fullscreen takeover, etc.). */
  active?: boolean;
  fill?: boolean;
}

/** Placeholder frame with a mock detection overlay. Set `camera.streamUrl` to play a real <video>. */
function CameraFeedComponent({ camera, detections, showOverlay, active = true, fill = false }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const offline = camera.status === "offline";
  const hasStream = Boolean(camera.streamUrl) && !offline;
  useLiveStream(videoRef, hasStream ? camera.streamUrl : undefined, active);

  const boxes = useMemo(() => {
    const seed = Number(camera.id.replace(/\D/g, "")) || 1;
    const shift = (seed * 7) % 12;
    return detections.slice(0, 2).map((detection, index) => ({
      detection,
      left: (index === 0 ? 14 : 56) + shift,
      top: (index === 0 ? 44 : 36) + (shift % 6),
      width: index === 0 ? 26 : 22,
      height: index === 0 ? 32 : 28,
    }));
  }, [camera.id, detections]);

  return (
    <div className={cn("relative w-full overflow-hidden bg-feed text-white", fill ? "h-full" : "aspect-video")}>
      {hasStream && <video ref={videoRef} muted playsInline loop className="absolute inset-0 h-full w-full object-cover" />}

      {!hasStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/40">
          <FontAwesomeIcon icon={offline ? faVideoSlash : active ? faVideo : faPause} className="text-2xl" />
          <span className="px-2 text-center text-xs">{offline ? "No signal" : active ? "Placeholder feed · no stream connected" : "Paused"}</span>
        </div>
      )}

      <span className="absolute left-2 top-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium">{camera.id}</span>
      <span
        className={cn(
          "absolute right-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-medium",
          offline ? "bg-danger text-white" : camera.status === "warning" ? "bg-warning text-fg" : "bg-white/10",
        )}
      >
        {offline ? "OFFLINE" : camera.status === "warning" ? "WEAK SIGNAL" : hasStream ? "LIVE" : "DEMO"}
      </span>

      {showOverlay &&
        active &&
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

export const CameraFeed = memo(CameraFeedComponent);
