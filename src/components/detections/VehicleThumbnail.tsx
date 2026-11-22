import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { VehicleType } from "@/types";
import { VEHICLE_TYPE_ICONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Placeholder thumbnail. Swap for a real <Image> once the API returns snapshots. */
export function VehicleThumbnail({ type, className }: { type: VehicleType; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`${type} snapshot placeholder`}
      className={cn("flex h-9 w-12 shrink-0 items-center justify-center rounded border border-line bg-subtle text-muted", className)}
    >
      <FontAwesomeIcon icon={VEHICLE_TYPE_ICONS[type]} />
    </span>
  );
}
