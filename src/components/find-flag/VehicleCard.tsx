import { memo } from "react";
import type { Vehicle } from "@/types";
import { PlateTag } from "@/components/detections/PlateTag";
import { VehicleThumbnail } from "@/components/detections/VehicleThumbnail";
import { cn, formatDateTime, vehicleDescription } from "@/lib/utils";

interface VehicleCardProps {
  vehicle: Vehicle;
  selected: boolean;
  onSelect: () => void;
}

function VehicleCardComponent({ vehicle, selected, onSelect }: VehicleCardProps) {
  const matches = vehicle.totalSightings;
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
      <VehicleThumbnail
        type={vehicle.type}
        eventId={vehicle.latestEventId}
        hasImage={vehicle.hasVehicleImage}
        kind="vehicle"
        className="h-12 w-16"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <PlateTag plate={vehicle.plate} />
          <span className="text-xs text-muted">{matches} match{matches === 1 ? "" : "es"}</span>
        </span>
        <span className="mt-1.5 block truncate text-sm font-medium">{vehicleDescription(vehicle.color, vehicle.make)}</span>
        <span className="block text-xs text-muted">Last seen {formatDateTime(vehicle.lastSeen)}</span>
      </span>
      {vehicle.hasPlateImage && (
        <VehicleThumbnail
          type={vehicle.type}
          eventId={vehicle.latestEventId}
          hasImage
          kind="plate"
          alt={`Plate ${vehicle.plate} crop`}
          className="hidden h-9 w-20 sm:flex"
        />
      )}
    </button>
  );
}

export const VehicleCard = memo(VehicleCardComponent);
