import type { Detection } from "@/types";
import { ConfidenceCell } from "@/components/detections/ConfidenceCell";
import { PlateTag } from "@/components/detections/PlateTag";
import { VehicleThumbnail } from "@/components/detections/VehicleThumbnail";
import { ChartCard } from "@/components/ui/ChartCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatTime } from "@/lib/utils";

export function RecentDetectionsPanel({ detections, title }: { detections: Detection[]; title: string }) {
  return (
    <ChartCard title="Recent detections" description={title} bodyClassName="p-0">
      {detections.length === 0 ? (
        <EmptyState title="No recent detections" description="Detections appear here as vehicles pass the camera." />
      ) : (
        <ul className="divide-y divide-line">
          {detections.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-3">
              <VehicleThumbnail type={d.vehicleType} />
              <div className="min-w-0 flex-1">
                <PlateTag plate={d.plate} />
                <p className="mt-1 truncate text-xs text-muted">
                  {d.cameraId} · {formatTime(d.detectedAt)}
                </p>
              </div>
              <ConfidenceCell value={d.confidence} />
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
