"use client";

import { useEffect, useState } from "react";
import { faIdCard } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { VehicleType } from "@/types";
import { VEHICLE_TYPE_ICONS, VEHICLE_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface VehicleThumbnailProps {
  type: VehicleType;
  className?: string;
  /** Event ID used to load `/api/images/{eventId}/{kind}` without exposing storage keys. */
  eventId?: string;
  hasImage?: boolean;
  kind?: "vehicle" | "plate";
  /** Renders the full uncropped snapshot at its native aspect ratio (`w-full h-auto`). */
  natural?: boolean;
  alt?: string;
}

/**
 * Lazy-loaded snapshot backed by `/api/images/[eventId]/[kind]`.
 * Never crops (`object-contain` everywhere); `natural` renders the full-resolution image at its native aspect ratio.
 */
export function VehicleThumbnail({
  type,
  className,
  eventId,
  hasImage = false,
  kind = "vehicle",
  natural = false,
  alt,
}: VehicleThumbnailProps) {
  const src = eventId && hasImage ? `/api/images/${encodeURIComponent(eventId)}/${kind}` : null;
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(src ? "loading" : "error");

  useEffect(() => {
    setStatus(src ? "loading" : "error");
  }, [src]);

  const label =
    alt ??
    (kind === "plate"
      ? "License plate snapshot"
      : `${VEHICLE_TYPE_LABELS[type] ?? type} snapshot`);

  if (!src || status === "error") {
    return (
      <span
        role="img"
        aria-label={`${label} unavailable`}
        className={cn(
          "flex shrink-0 items-center justify-center rounded border border-line bg-subtle text-muted",
          natural ? "min-h-40 w-full rounded-md text-3xl" : "h-10 w-14",
          className,
        )}
      >
        <FontAwesomeIcon icon={kind === "plate" ? faIdCard : VEHICLE_TYPE_ICONS[type]} />
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
        {status === "loading" && <span className="absolute inset-0 animate-pulse bg-subtle" aria-hidden="true" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
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
        "relative flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-canvas",
        className,
      )}
    >
      {status === "loading" && <span className="absolute inset-0 animate-pulse bg-subtle" aria-hidden="true" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        loading="lazy"
        decoding="async"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        className={cn(
          "h-full w-full object-contain transition-opacity",
          status === "loaded" ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}
