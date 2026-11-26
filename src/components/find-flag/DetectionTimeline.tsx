import type { Detection } from "@/types";
import { ConfidenceCell } from "@/components/detections/ConfidenceCell";
import { formatDateTime } from "@/lib/utils";

export function DetectionTimeline({ detections }: { detections: Detection[] }) {
  return (
    <ol className="relative space-y-5 border-l border-line pl-6">
      {detections.length === 0 && <li className="text-sm text-muted">No detections match the current filters.</li>}
      {detections.map((d) => (
        <li key={d.id} className="relative">
          <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" aria-hidden="true" />
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <p className="text-sm font-medium">{d.cameraName}</p>
            <time dateTime={d.detectedAt} className="text-xs text-muted">
              {formatDateTime(d.detectedAt)} UTC
            </time>
          </div>
          <p className="text-xs text-muted">
            {d.cameraId} · {d.location} · Confidence <ConfidenceCell value={d.confidence} />
          </p>
        </li>
      ))}
    </ol>
  );
}
