"use client";

import { Drawer } from "@/components/ui/Drawer";
import type { Detection } from "@/types";
import { formatDateTime } from "@/lib/utils";
import { ConfidenceCell } from "./ConfidenceCell";
import { PlateTag } from "./PlateTag";
import { VehicleThumbnail } from "./VehicleThumbnail";

interface DetectionDetailDrawerProps {
  detection: Detection | null;
  onClose: () => void;
}

export function DetectionDetailDrawer({ detection, onClose }: DetectionDetailDrawerProps) {
  return (
    <Drawer open={detection !== null} onClose={onClose} title="Detection details">
      {detection && (
        <div className="space-y-5">
          <div className="flex aspect-video items-center justify-center rounded-md border border-line bg-subtle">
            <VehicleThumbnail type={detection.vehicleType} className="h-16 w-24 text-3xl" />
          </div>
          <div className="flex items-center justify-between">
            <PlateTag plate={detection.plate} />
            <ConfidenceCell value={detection.confidence} />
          </div>
          <dl className="divide-y divide-line text-sm">
            {[
              ["Detection ID", detection.id],
              ["Vehicle type", detection.vehicleType],
              ["Make and model", detection.make],
              ["Color", detection.color],
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
