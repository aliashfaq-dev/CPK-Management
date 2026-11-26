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
  { label: "Vehicle image" },
  { label: "Vehicle type" },
  { label: "License plate" },
  { label: "Camera" },
  { label: "Location" },
  { label: "Time" },
  { label: "Confidence" },
];

function Plate({ detection }: { detection: Detection }) {
  return detection.hasPlate && detection.plate ? <PlateTag plate={detection.plate} /> : <span className="text-xs text-muted">No plate read</span>;
}

function DetectionTableComponent({ detections, variant = "full", sortKey, sortDirection, onSort, onSelect, highlightIds }: DetectionTableProps) {
  const full = variant === "full";
  const headers = full ? FULL_HEADERS : COMPACT_HEADERS;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-subtle text-xs text-muted">
            {headers.map((header) => {
              const active = header.key !== undefined && header.key === sortKey;
              const ariaSort = active ? (sortDirection === "asc" ? "ascending" : "descending") : header.key ? "none" : undefined;
              return (
                <th key={header.label} scope="col" aria-sort={ariaSort} className={cn("px-4 py-3 font-medium", header.className)}>
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
          ) : detections.map((d) => (
            <tr
              key={d.id}
              onClick={onSelect ? () => onSelect(d) : undefined}
              className={cn(onSelect && "cursor-pointer", "hover:bg-subtle", highlightIds?.has(d.id) && "bg-accent-soft")}
            >
              <td className="px-4 py-3">
                <VehicleThumbnail type={d.vehicleType} eventId={d.id} hasImage={d.hasVehicleImage} />
              </td>
              {full ? (
                <>
                  <td className="px-4 py-3"><Plate detection={d} /></td>
                  <td className="px-4 py-3">{VEHICLE_TYPE_LABELS[d.vehicleType] ?? d.vehicleType}</td>
                  <td className="px-4 py-3 text-muted">{d.cameraId}</td>
                </>
              ) : (
                <>
                  <td className="px-4 py-3">{VEHICLE_TYPE_LABELS[d.vehicleType] ?? d.vehicleType}</td>
                  <td className="px-4 py-3"><Plate detection={d} /></td>
                  <td className="px-4 py-3 text-muted">{d.cameraName}</td>
                </>
              )}
              <td className="px-4 py-3 text-muted">{d.location}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(d.detectedAt)}</td>
              <td className="px-4 py-3">{d.hasPlate ? <ConfidenceCell value={d.confidence} /> : <span className="text-xs text-muted">—</span>}</td>
              {full && (
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" icon={faEye} aria-label={`View details for ${d.plate || "detection " + d.id}`} onClick={() => onSelect?.(d)}>
                    View
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const DetectionTable = memo(DetectionTableComponent);
