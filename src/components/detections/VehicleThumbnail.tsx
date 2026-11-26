import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { VehicleType } from "@/types";
import { VEHICLE_TYPE_ICONS, VEHICLE_TYPE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface VehicleThumbnailProps {
  type: VehicleType;
  className?: string;
  /** Event whose snapshot to show (wired to /api/images in the images phase). */
  eventId?: string;
  hasImage?: boolean;
  kind?: "vehicle" | "plate";
}

/** Vehicle snapshot placeholder (type icon). */
export function VehicleThumbnail({ type, className }: VehicleThumbnailProps) {
  return (
    <span
      role="img"
      aria-label={`${VEHICLE_TYPE_LABELS[type] ?? type} snapshot placeholder`}
      className={cn("flex h-9 w-12 shrink-0 items-center justify-center rounded border border-line bg-subtle text-muted", className)}
    >
      <FontAwesomeIcon icon={VEHICLE_TYPE_ICONS[type]} />
    </span>
  );
}
