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
  alt?: string;
}

/**
 * Lazy-loaded snapshot thumbnail backed by `/api/images/[eventId]/[kind]`.
 * Shows a pulse skeleton while loading and falls back to a clean placeholder if absent or unreachable.
 */
export function VehicleThumbnail({
  type,
  className,
  eventId,
  hasImage = false,
  kind = "vehicle",
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
          "flex h-9 w-12 shrink-0 items-center justify-center rounded border border-line bg-subtle text-muted",
          className,
        )}
      >
        <FontAwesomeIcon icon={kind === "plate" ? faIdCard : VEHICLE_TYPE_ICONS[type]} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-subtle",
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
          "h-full w-full transition-opacity",
          kind === "plate" ? "object-contain bg-canvas p-0.5" : "object-cover",
          status === "loaded" ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}
