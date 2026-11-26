"use client";

import { memo } from "react";
import { faEye, faSort, faSortDown, faSortUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Detection, DetectionSortKey, SortDirection } from "@/types";
import { Button } from "@/components/ui/Button";
import { VEHICLE_TYPE_LABELS } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { ConfidenceCell } from "./ConfidenceCell";
import { PlateTag } from "./PlateTag";
import { VehicleThumbnail } from "./VehicleThumbnail";

interface DetectionTableProps {
  detections: Detection[];
  variant?: "compact" | "full";
  sortKey?: DetectionSortKey;
  sortDirection?: SortDirection;
  onSort?: (key: DetectionSortKey) => void;
  onSelect?: (detection: Detection) => void;
  /** Ids to highlight as freshly arrived (live updates). */
  highlightIds?: ReadonlySet<string>;
}

interface Header {
  label: string;
  key?: DetectionSortKey;
  className?: string;
}

const FULL_HEADERS: Header[] = [
  { label: "Vehicle" },
  { label: "License plate", key: "plate" },
  { label: "Vehicle type", key: "vehicleType" },
  { label: "Camera ID", key: "cameraId" },
  { label: "Location" },
  { label: "Detection time", key: "detectedAt" },
  { label: "Confidence", key: "confidence" },
  { label: "Actions", className: "text-right" },
];

const COMPACT_HEADERS: Header[] = [
  { label: "Vehicle" },
  { label: "Type" },
  { label: "Plate" },
  { label: "Camera" },
  { label: "Time" },
  { label: "Confidence", className: "text-right" },
];

function Plate({ detection, priority, compact }: { detection: Detection; priority: boolean; compact: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {detection.hasPlateImage && (
        <VehicleThumbnail
          type={detection.vehicleType}
          eventId={detection.id}
          hasImage
          kind="plate"
          size={320}
          priority={priority}
          alt={detection.plate ? `Plate ${detection.plate} crop` : "Plate crop"}
          className={compact ? "hidden h-6 w-14 xl:inline-flex" : "h-7 w-16"}
        />
      )}
      {detection.hasPlate && detection.plate ? (
        <PlateTag plate={detection.plate} />
      ) : (
        <span className="text-xs text-muted">No plate read</span>
      )}
    </div>
  );
}

function DetectionTableComponent({
  detections,
  variant = "full",
  sortKey,
  sortDirection,
  onSort,
  onSelect,
  highlightIds,
}: DetectionTableProps) {
  const full = variant === "full";
  const headers = full ? FULL_HEADERS : COMPACT_HEADERS;
  const cellPad = full ? "px-4 py-3" : "px-3 py-2.5";

  return (
    <div className={cn(full ? "overflow-x-auto" : "overflow-x-hidden")}>
      <table className={cn("w-full text-left text-sm", full && "min-w-[680px]")}>
        <thead>
          <tr className="border-b border-line bg-subtle text-xs text-muted">
            {headers.map((header) => {
              const active = header.key !== undefined && header.key === sortKey;
              const ariaSort = active ? (sortDirection === "asc" ? "ascending" : "descending") : header.key ? "none" : undefined;
              return (
                <th key={header.label} scope="col" aria-sort={ariaSort} className={cn(cellPad, "font-medium", header.className)}>
                  {header.key && onSort ? (
                    <button type="button" onClick={() => onSort(header.key as DetectionSortKey)} className="inline-flex items-center gap-1.5 hover:text-fg">
                      {header.label}
                      <FontAwesomeIcon icon={active ? (sortDirection === "asc" ? faSortUp : faSortDown) : faSort} className="text-[10px]" />
                    </button>
                  ) : (
                    header.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {detections.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-10 text-center text-sm text-muted">
                No detection records yet. New detections will appear here as they arrive.
              </td>
            </tr>
          ) : (
            detections.map((d, index) => {
              const priority = index < 8;
              const hasRealLocation = Boolean(d.location && d.location !== "Location unavailable");
              return (
                <tr
                  key={d.id}
                  onClick={onSelect ? () => onSelect(d) : undefined}
                  className={cn(onSelect && "cursor-pointer", "hover:bg-subtle", highlightIds?.has(d.id) && "bg-accent-soft")}
                >
                  <td className={cellPad}>
                    <VehicleThumbnail
                      type={d.vehicleType}
                      eventId={d.id}
                      hasImage={d.hasVehicleImage}
                      size={160}
                      priority={priority}
                    />
                  </td>
                  {full ? (
                    <>
                      <td className={cellPad}><Plate detection={d} priority={priority} compact={false} /></td>
                      <td className={cellPad}>{VEHICLE_TYPE_LABELS[d.vehicleType] ?? d.vehicleType}</td>
                      <td className={cn(cellPad, "text-muted")}>{d.cameraId}</td>
                      <td className={cn(cellPad, "max-w-48 truncate text-muted")}>{hasRealLocation ? d.location : "—"}</td>
                      <td className={cn(cellPad, "whitespace-nowrap text-muted")}>{formatDateTime(d.detectedAt)}</td>
                      <td className={cellPad}>{d.hasPlate ? <ConfidenceCell value={d.confidence} /> : <span className="text-xs text-muted">—</span>}</td>
                      <td className={cn(cellPad, "text-right")}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={faEye}
                          aria-label={`View details for ${d.plate || "detection " + d.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect?.(d);
                          }}
                        >
                          View
                        </Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className={cn(cellPad, "whitespace-nowrap")}>{VEHICLE_TYPE_LABELS[d.vehicleType] ?? d.vehicleType}</td>
                      <td className={cellPad}><Plate detection={d} priority={priority} compact /></td>
                      <td className={cn(cellPad, "max-w-36 truncate text-muted")}>
                        <span className="block truncate text-fg">{d.cameraName}</span>
                        {hasRealLocation && <span className="block truncate text-xs text-muted">{d.location}</span>}
                      </td>
                      <td className={cn(cellPad, "whitespace-nowrap text-xs text-muted")}>{formatDateTime(d.detectedAt)}</td>
                      <td className={cn(cellPad, "whitespace-nowrap text-right")}>
                        {d.hasPlate ? <ConfidenceCell value={d.confidence} /> : <span className="text-xs text-muted">—</span>}
                      </td>
                    </>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export const DetectionTable = memo(DetectionTableComponent);
