"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { faColumns, faDownload, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Detection, DetectionQuery, DetectionSortKey, Page } from "@/types";
import { AssistantChat } from "@/components/ui/AssistantChat";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Popover } from "@/components/ui/Popover";
import { useLiveDetectionSubscription } from "@/hooks/useLiveEvents";
import { filtersToParams, normalizePlate, ocrFoldPlate } from "@/lib/detection-query";
import { cn, formatNumber } from "@/lib/utils";
import { DetectionDetailDrawer } from "./DetectionDetailDrawer";
import { DetectionTable, type OptionalColumnKey } from "./DetectionTable";

interface DetectionsViewProps {
  result: Page<Detection>;
  query: DetectionQuery;
}

const COLUMN_OPTIONS: Array<{ key: OptionalColumnKey; label: string }> = [
  { key: "cameraId", label: "Camera ID" },
  { key: "location", label: "Location" },
  { key: "detectedAt", label: "Detection time" },
  { key: "confidence", label: "Confidence" },
];

function matchesQuery(detection: Detection, query: DetectionQuery): boolean {
  if (query.plate) {
    const norm = normalizePlate(detection.plate);
    if (query.plateMode === "exact") {
      if (norm !== normalizePlate(query.plate)) return false;
    } else if (query.plateMode === "fuzzy") {
      if (!ocrFoldPlate(norm).includes(ocrFoldPlate(query.plate))) return false;
    } else if (!norm.includes(normalizePlate(query.plate))) {
      return false;
    }
  }
  if (query.plateExact && normalizePlate(detection.plate) !== normalizePlate(query.plateExact)) {
    return false;
  }
  if (query.types && query.types.length > 0 && !query.types.includes(detection.vehicleType)) {
    return false;
  }
  if (query.type && detection.vehicleType !== query.type) return false;
  if (query.camera && detection.cameraId !== query.camera) return false;
  if (query.from && detection.detectedAt < query.from) return false;
  if (query.to && detection.detectedAt >= query.to) return false;
  if (query.colours && query.colours.length > 0) {
    if (!query.colours.includes((detection.color ?? "").toLowerCase())) return false;
  }
  if (query.colour && (detection.color ?? "").toLowerCase() !== query.colour.toLowerCase()) return false;
  if (query.make && !(detection.make ?? "").toLowerCase().includes(query.make.toLowerCase())) return false;
  if (query.model && !(detection.make ?? "").toLowerCase().includes(query.model.toLowerCase())) return false;
  if (query.hasPlate !== undefined && detection.hasPlate !== query.hasPlate) return false;
  if (query.minConfidence && detection.confidence < query.minConfidence) return false;
  return true;
}

function hasActiveFilter(query: DetectionQuery): boolean {
  return Boolean(
    query.plate ||
      query.plateExact ||
      query.type ||
      (query.types && query.types.length > 0) ||
      query.camera ||
      query.from ||
      query.to ||
      query.colour ||
      (query.colours && query.colours.length > 0) ||
      query.make ||
      query.model ||
      query.hasPlate !== undefined ||
      query.minConfidence,
  );
}

/** AI-only searchable, sortable, column-customizable, server-paginated detections view. */
export function DetectionsView({ result, query }: DetectionsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Detection | null>(null);
  const [rows, setRows] = useState<Detection[]>(result.rows);
  const [total, setTotal] = useState<number>(result.total);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(() => new Set());
  const [hiddenColumns, setHiddenColumns] = useState<Set<OptionalColumnKey>>(() => new Set());

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

  const onAiFilterHref = useCallback(
    (href: string) => {
      startTransition(() => router.push(href));
    },
    [router],
  );

  const handleSort = (key: DetectionSortKey) => {
    if (key === query.sort) navigate({ dir: query.dir === "asc" ? "desc" : "asc" });
    else navigate({ sort: key, dir: key === "detectedAt" || key === "confidence" ? "desc" : "asc" });
  };

  const toggleColumn = (key: OptionalColumnKey) => {
    setHiddenColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exportHref = `/api/detections/export?${filtersToParams(query).toString()}`;
  const filtered = hasActiveFilter(query);

  return (
    <>
      <AssistantChat
        className="mb-4"
        title="Search detections with AI"
        description="Ask in English or Roman Urdu — the table and CSV export below update automatically to match what Gemini finds."
        onSearchFilterHref={onAiFilterHref}
      />

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
                Reset to all records
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Popover
              label="Toggle table columns"
              buttonClassName="border border-line bg-surface px-3 text-xs font-medium text-fg hover:bg-subtle h-8"
              panelClassName="w-48"
              trigger={
                <>
                  <FontAwesomeIcon icon={faColumns} className="text-xs text-muted" />
                  Columns
                </>
              }
            >
              {() => (
                <div className="p-2">
                  <p className="px-2 py-1 text-[11px] font-semibold text-muted">Visible columns</p>
                  {COLUMN_OPTIONS.map((col) => {
                    const checked = !hiddenColumns.has(col.key);
                    return (
                      <label
                        key={col.key}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-subtle"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleColumn(col.key)}
                          className="h-3.5 w-3.5 accent-accent"
                        />
                        <span>{col.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </Popover>
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
        </div>

        {total === 0 ? (
          <EmptyState
            title={filtered ? "No detections match this AI search" : "No detections yet"}
            description={
              filtered
                ? "Ask a broader question above or reset to view every recorded detection."
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
              hiddenColumns={hiddenColumns}
            />
            <Pagination page={result.page} pageSize={result.pageSize} total={total} onPageChange={(page) => navigate({ page })} />
          </>
        )}
      </Card>

      <DetectionDetailDrawer detection={selected} onClose={() => setSelected(null)} />
    </>
  );
}
