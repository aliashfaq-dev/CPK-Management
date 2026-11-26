"use client";

import { memo, useEffect, useRef, useState } from "react";
import { faCircleExclamation, faPause, faStop, faVideo, faVideoSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Camera, Detection } from "@/types";
import { useLiveStream } from "@/hooks/useLiveStream";
import { cn } from "@/lib/utils";

interface CameraFeedProps {
  camera: Camera;
  detections?: Detection[];
  showOverlay?: boolean;
  /** When false the stream is unmounted/released (hidden tab, fullscreen takeover, etc.). */
  active?: boolean;
  fill?: boolean;
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const sync = () => setVisible(!document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return visible;
}

/**
 * Renders either:
 * 1. Annotated MJPEG frames from `/api/live/frames/{streamId}` when a pipeline stream is attached
 *    (bounding boxes are already drawn in the JPEG by the detector; unmounted on tab hide/leave to drop WS), or
 * 2. The progressive MP4 fallback when `PIPELINE_URL` is not configured.
 */
function CameraFeedComponent({ camera, active = true, fill = false }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const visible = usePageVisible();
  const [retryNonce, setRetryNonce] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasPipelineStream = Boolean(camera.streamId);
  const streamState = camera.streamState ?? "stopped";
  const mjpegRunning = hasPipelineStream && streamState === "running" && active && visible;

  const fallbackVideoActive = !hasPipelineStream && Boolean(camera.streamUrl) && camera.status !== "offline";
  useLiveStream(videoRef, fallbackVideoActive ? camera.streamUrl : undefined, active);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const scheduleReconnect = () => {
    if (retryTimerRef.current || !mjpegRunning) return;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setRetryNonce((value) => value + 1);
    }, 2_000);
  };

  const mjpegSrc =
    mjpegRunning && camera.streamId
      ? `/api/live/frames/${encodeURIComponent(camera.streamId)}?r=${retryNonce}`
      : undefined;

  const badgeLabel = hasPipelineStream
    ? streamState === "running"
      ? `RUNNING${camera.fps ? ` · ${camera.fps.toFixed(1)} FPS` : ""}`
      : streamState === "error"
        ? "ERROR"
        : "STOPPED"
    : camera.status === "offline"
      ? "OFFLINE"
      : fallbackVideoActive
        ? "FALLBACK MP4"
        : "NO STREAM";

  const badgeTone = hasPipelineStream
    ? streamState === "running"
      ? "bg-success text-white"
      : streamState === "error"
        ? "bg-danger text-white"
        : "bg-white/15 text-white"
    : camera.status === "offline"
      ? "bg-danger text-white"
      : "bg-white/15 text-white";

  return (
    <div className={cn("relative w-full overflow-hidden bg-feed text-white", fill ? "h-full" : "aspect-video")}>
      {mjpegSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mjpegSrc}
          alt={`${camera.name} annotated live stream`}
          onError={scheduleReconnect}
          className="absolute inset-0 h-full w-full object-contain"
        />
      )}

      {fallbackVideoActive && (
        <video ref={videoRef} muted playsInline loop className="absolute inset-0 h-full w-full object-cover" />
      )}

      {!mjpegSrc && !fallbackVideoActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-white/60">
          <FontAwesomeIcon
            icon={
              hasPipelineStream
                ? streamState === "error"
                  ? faCircleExclamation
                  : !active || !visible
                    ? faPause
                    : faStop
                : camera.status === "offline"
                  ? faVideoSlash
                  : faVideo
            }
            className="text-2xl"
          />
          <span className="text-xs font-medium">
            {hasPipelineStream
              ? !active || !visible
                ? "Preview paused while hidden"
                : streamState === "error"
                  ? camera.streamError || "Stream error"
                  : "Stream stopped"
              : camera.status === "offline"
                ? "Camera offline"
                : "No pipeline stream assigned"}
          </span>
        </div>
      )}

      <span className="absolute left-2 top-2 rounded bg-fg/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {camera.id}
      </span>
      <span className={cn("absolute right-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-semibold", badgeTone)}>
        {badgeLabel}
      </span>
    </div>
  );
}

export const CameraFeed = memo(CameraFeedComponent);
