"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { faDownload, faXmark } from "@fortawesome/free-solid-svg-icons";
import type { Detection, DetectionQuery, DetectionSortKey, Page } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { useLiveDetectionSubscription } from "@/hooks/useLiveEvents";
import { filtersToParams, normalizePlate } from "@/lib/detection-query";
import { cn, formatNumber } from "@/lib/utils";
import { DetectionDetailDrawer } from "./DetectionDetailDrawer";
import { DetectionTable } from "./DetectionTable";

interface DetectionsViewProps {
  result: Page<Detection>;
  query: DetectionQuery;
}

function matchesQuery(detection: Detection, query: DetectionQuery): boolean {
  if (query.plate) {
    const norm = normalizePlate(detection.plate);
    if (!norm.includes(normalizePlate(query.plate))) return false;
  }
  if (query.plateExact && normalizePlate(detection.plate) !== normalizePlate(query.plateExact)) {
    return false;
  }
  if (query.type && detection.vehicleType !== query.type) return false;
  if (query.camera && detection.cameraId !== query.camera) return false;
  if (query.from && detection.detectedAt < query.from) return false;
  if (query.to && detection.detectedAt >= query.to) return false;
  if (query.colour && (detection.color ?? "").toLowerCase() !== query.colour.toLowerCase()) return false;
  if (query.hasPlate !== undefined && detection.hasPlate !== query.hasPlate) return false;
  if (query.minConfidence && detection.confidence < query.minConfidence) return false;
  return true;
}

function hasActiveFilter(query: DetectionQuery): boolean {
  return Boolean(
    query.plate ||
      query.plateExact ||
      query.type ||
      query.camera ||
      query.from ||
      query.to ||
      query.colour ||
      query.hasPlate !== undefined ||
      query.minConfidence,
  );
}

/** Server-paginated detections table with live SSE row insertion and CSV export. */
export function DetectionsView({ result, query }: DetectionsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Detection | null>(null);
  const [rows, setRows] = useState<Detection[]>(result.rows);
  const [total, setTotal] = useState<number>(result.total);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setRows(result.rows);
    setTotal(result.total);
    setHighlightIds(new Set());
  }, [result]);

  useLiveDetectionSubscription(({ detection, isUpdate }) => {
    if (isUpdate) {
      setRows((current) => current.map((row) => (row.id === detection.id ? detection : row)));
      setSelected((current) => (current?.id === detection.id ? detection : current));
      return;
    }

    if (!matchesQuery(detection, query)) return;

    setTotal((current) => current + 1);
    if (query.page === 1 && query.sort === "detectedAt" && query.dir === "desc") {
      setRows((current) => {
        if (current.some((row) => row.id === detection.id)) return current;
        return [detection, ...current].slice(0, result.pageSize);
      });
      setHighlightIds((current) => {
        const next = new Set(current);
        next.add(detection.id);
        return next;
      });
      window.setTimeout(() => {
        setHighlightIds((current) => {
          if (!current.has(detection.id)) return current;
          const next = new Set(current);
          next.delete(detection.id);
          return next;
        });
      }, 6_000);
    }
  });

  const navigate = (patch: Partial<DetectionQuery>) => {
    const next = { ...query, page: 1, ...patch };
    const search = filtersToParams(next).toString();
    startTransition(() => router.push(search ? `${pathname}?${search}` : pathname));
  };

  const handleSort = (key: DetectionSortKey) => {
    if (key === query.sort) navigate({ dir: query.dir === "asc" ? "desc" : "asc" });
    else navigate({ sort: key, dir: key === "detectedAt" || key === "confidence" ? "desc" : "asc" });
  };

  const exportHref = `/api/detections/export?${filtersToParams(query).toString()}`;
  const filtered = hasActiveFilter(query);

  return (
    <>
      <Card className={cn("overflow-hidden transition-opacity", pending && "opacity-60")} aria-busy={pending}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="font-medium text-fg">
              {formatNumber(total)} detection{total === 1 ? "" : "s"}
            </span>
            {filtered && (
              <Button
                variant="ghost"
                size="sm"
                icon={faXmark}
                onClick={() => startTransition(() => router.push(pathname))}
              >
                Show all detections
              </Button>
            )}
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={faDownload}
            onClick={() => window.location.assign(exportHref)}
            disabled={total === 0}
          >
            Export CSV
          </Button>
        </div>

        {total === 0 ? (
          <EmptyState
            title={filtered ? "No detections match this search" : "No detections yet"}
            description={
              filtered
                ? "Clear the active search to view all recorded detections."
                : "New vehicle detections will appear here automatically."
            }
          />
        ) : (
          <>
            <DetectionTable
              detections={rows}
              sortKey={query.sort}
              sortDirection={query.dir}
              onSort={handleSort}
              onSelect={setSelected}
              highlightIds={highlightIds}
            />
            <Pagination page={result.page} pageSize={result.pageSize} total={total} onPageChange={(page) => navigate({ page })} />
          </>
        )}
      </Card>

      <DetectionDetailDrawer detection={selected} onClose={() => setSelected(null)} />
    </>
  );
}
