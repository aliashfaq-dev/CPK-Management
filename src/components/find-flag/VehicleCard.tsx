import { memo } from "react";
import type { Vehicle } from "@/types";
import { PlateTag } from "@/components/detections/PlateTag";
import { VehicleThumbnail } from "@/components/detections/VehicleThumbnail";
import { cn, formatDateTime } from "@/lib/utils";

interface VehicleCardProps {
  vehicle: Vehicle;
  matches: number;
  selected: boolean;
  onSelect: () => void;
}

function VehicleCardComponent({ vehicle, matches, selected, onSelect }: VehicleCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border bg-surface p-4 text-left transition-colors",
        selected ? "border-accent bg-accent-soft" : "border-line hover:bg-subtle",
      )}
    >
      <VehicleThumbnail type={vehicle.type} className="h-11 w-14" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <PlateTag plate={vehicle.plate} />
          <span className="text-xs text-muted">{matches} match{matches === 1 ? "" : "es"}</span>
        </span>
        <span className="mt-1.5 block truncate text-sm font-medium">
          {vehicle.color} {vehicle.make}
        </span>
        <span className="block text-xs text-muted">Last seen {formatDateTime(vehicle.lastSeen)}</span>
      </span>
    </button>
  );
}

export const VehicleCard = memo(VehicleCardComponent);
