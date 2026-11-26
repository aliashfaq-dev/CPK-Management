"use client";

import { useEffect, useState } from "react";
import { faIdCard, faRotateRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { VehicleType } from "@/types";
import { VEHICLE_TYPE_ICONS, VEHICLE_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type ThumbnailWidth = 0 | 160 | 320 | 640;

interface VehicleThumbnailProps {
  type: VehicleType;
  className?: string;
  /** Event ID used to load `/api/images/{eventId}/{kind}?w={size}` without exposing storage keys. */
  eventId?: string;
  hasImage?: boolean;
  kind?: "vehicle" | "plate";
  /** Requested WebP width (`160`, `320`, `640`, or `0` for original). */
  size?: ThumbnailWidth;
  /** High-priority eager fetch for the first ~8 visible thumbnails in viewport. */
  priority?: boolean;
  /** Renders the full uncropped snapshot at its native aspect ratio (`w-full h-auto`). */
  natural?: boolean;
  alt?: string;
}

/**
 * Resized WebP snapshot backed by `/api/images/[eventId]/[kind]?w=<size>`.
 * Includes explicit intrinsic dimensions (no CLS), priority hints for above-the-fold rows,
 * pulse skeleton while loading, automatic single retry on transient failure, and icon fallback.
 */
export function VehicleThumbnail({
  type,
  className,
  eventId,
  hasImage = false,
  kind = "vehicle",
  size,
  priority = false,
  natural = false,
  alt,
}: VehicleThumbnailProps) {
  const resolvedSize: ThumbnailWidth =
    size ?? (natural ? 640 : kind === "plate" ? 320 : 160);

  const baseSrc =
    eventId && hasImage
      ? `/api/images/${encodeURIComponent(eventId)}/${kind}?w=${resolvedSize}`
      : null;

  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    baseSrc ? "loading" : "error",
  );

  useEffect(() => {
    setAttempt(0);
    setStatus(baseSrc ? "loading" : "error");
  }, [baseSrc]);

  const handleError = () => {
    // Automatically retry once before showing the fallback placeholder.
    if (attempt < 1) {
      window.setTimeout(() => {
        setAttempt((current) => current + 1);
        setStatus("loading");
      }, 600);
      return;
    }
    setStatus("error");
  };

  const manualRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setAttempt((current) => current + 1);
    setStatus("loading");
  };

  const src = baseSrc ? (attempt > 0 ? `${baseSrc}&retry=${attempt}` : baseSrc) : null;

  const label =
    alt ??
    (kind === "plate"
      ? "License plate snapshot"
      : `${VEHICLE_TYPE_LABELS[type] ?? type} snapshot`);

  const intrinsicWidth = natural ? 640 : kind === "plate" ? 120 : 56;
  const intrinsicHeight = natural ? 480 : kind === "plate" ? 36 : 40;

  if (!src || status === "error") {
    return (
      <span
        role="img"
        aria-label={`${label} unavailable`}
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-1.5 rounded border border-line bg-subtle text-muted",
          natural ? "min-h-40 w-full rounded-md text-3xl" : "h-10 w-14",
          className,
        )}
      >
        <FontAwesomeIcon icon={kind === "plate" ? faIdCard : VEHICLE_TYPE_ICONS[type]} />
        {baseSrc && status === "error" && (
          <button
            type="button"
            onClick={manualRetry}
            title="Retry loading snapshot"
            aria-label={`Retry loading ${label}`}
            className="rounded p-0.5 text-[10px] text-muted hover:bg-surface hover:text-fg"
          >
            <FontAwesomeIcon icon={faRotateRight} />
          </button>
        )}
      </span>
    );
  }

  if (natural) {
    return (
      <div
        className={cn(
          "relative flex w-full items-center justify-center overflow-hidden rounded-md border border-line bg-canvas",
          status === "loading" && "min-h-48",
          className,
        )}
      >
        {status === "loading" && (
          <span className="absolute inset-0 animate-pulse bg-subtle" aria-hidden="true" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={src}
          src={src}
          alt={label}
          width={intrinsicWidth}
          height={intrinsicHeight}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={handleError}
          className={cn(
            "block h-auto max-h-[70vh] w-full object-contain transition-opacity",
            status === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    );
  }

  return (
    <span
      className={cn(
        "relative inline-flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-canvas",
        className,
      )}
    >
      {status === "loading" && (
        <span className="absolute inset-0 animate-pulse bg-subtle" aria-hidden="true" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt={label}
        width={intrinsicWidth}
        height={intrinsicHeight}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onLoad={() => setStatus("loaded")}
        onError={handleError}
        className={cn(
          "h-full w-full object-contain transition-opacity",
          status === "loaded" ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}
