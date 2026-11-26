"use client";

import { Drawer } from "@/components/ui/Drawer";
import type { Detection } from "@/types";
import { VEHICLE_TYPE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { ConfidenceCell } from "./ConfidenceCell";
import { PlateTag } from "./PlateTag";
import { VehicleThumbnail } from "./VehicleThumbnail";

interface DetectionDetailDrawerProps {
  detection: Detection | null;
  onClose: () => void;
}

const PENDING = "Not analysed yet";

export function DetectionDetailDrawer({ detection, onClose }: DetectionDetailDrawerProps) {
  return (
    <Drawer open={detection !== null} onClose={onClose} title="Detection details">
      {detection && (
        <div className="space-y-5">
          <div className="space-y-2">
            <span className="block text-xs font-medium text-muted">Vehicle snapshot</span>
            <VehicleThumbnail
              type={detection.vehicleType}
              eventId={detection.id}
              hasImage={detection.hasVehicleImage}
              kind="vehicle"
              className="aspect-video h-auto w-full rounded-md text-3xl"
            />
          </div>

          <div className="rounded-md border border-line bg-subtle p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="block text-xs text-muted">License plate</span>
                <div className="mt-1">
                  {detection.hasPlate && detection.plate ? (
                    <PlateTag plate={detection.plate} />
                  ) : (
                    <span className="text-sm text-muted">No plate read</span>
                  )}
                </div>
                {detection.hasPlate && (
                  <p className="mt-1 text-xs text-muted">
                    Read confidence <ConfidenceCell value={detection.confidence} />
                  </p>
                )}
              </div>
              {detection.hasPlateImage ? (
                <VehicleThumbnail
                  type={detection.vehicleType}
                  eventId={detection.id}
                  hasImage
                  kind="plate"
                  alt={detection.plate ? `Plate ${detection.plate} crop` : "Plate crop"}
                  className="h-14 w-36 rounded-md"
                />
              ) : (
                <span className="rounded border border-line bg-surface px-2.5 py-2 text-xs text-muted">
                  No plate crop
                </span>
              )}
            </div>
          </div>

          <dl className="divide-y divide-line text-sm">
            {[
              ["Detection ID", detection.id],
              ["Vehicle type", VEHICLE_TYPE_LABELS[detection.vehicleType] ?? detection.vehicleType],
              ["Make and model", detection.make ?? PENDING],
              ["Colour", detection.color ?? PENDING],
              ["Camera", `${detection.cameraId} · ${detection.cameraName}`],
              ["Location", detection.location],
              ["Detected at", `${formatDateTime(detection.detectedAt)} UTC`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Drawer>
  );
}
