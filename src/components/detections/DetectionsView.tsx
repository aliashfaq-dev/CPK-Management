"use client";

import { useMemo, useState } from "react";
import { faDownload, faRotateLeft } from "@fortawesome/free-solid-svg-icons";
import type { Camera, Detection, DetectionSortKey, SortDirection } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { PAGE_SIZE, VEHICLE_TYPES } from "@/lib/constants";
import { downloadCsv } from "@/lib/utils";
import { DetectionDetailDrawer } from "./DetectionDetailDrawer";
import { DetectionTable } from "./DetectionTable";

interface Filters {
  query: string;
  type: string;
  camera: string;
  date: string;
  minConfidence: string;
}

const CONFIDENCE_OPTIONS = [
  { value: "0", label: "Any confidence" },
  { value: "90", label: "90% or higher" },
  { value: "95", label: "95% or higher" },
  { value: "98", label: "98% or higher" },
];

export function DetectionsView({ detections, cameras, initialQuery = "" }: { detections: Detection[]; cameras: Camera[]; initialQuery?: string }) {
  const initialFilters: Filters = { query: initialQuery, type: "all", camera: "all", date: "", minConfidence: "0" };
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [sortKey, setSortKey] = useState<DetectionSortKey>("detectedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Detection | null>(null);

  const updateFilters = (patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const rows = useMemo(() => {
    const query = filters.query.trim().toLowerCase().replace(/[\s-]/g, "");
    const minConfidence = Number(filters.minConfidence);
    const filtered = detections.filter(
      (d) =>
        (!query || d.plate.toLowerCase().replace("-", "").includes(query)) &&
        (filters.type === "all" || d.vehicleType === filters.type) &&
        (filters.camera === "all" || d.cameraId === filters.camera) &&
        (!filters.date || d.detectedAt.slice(0, 10) === filters.date) &&
        d.confidence >= minConfidence,
    );
    return filtered.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right));
      return sortDirection === "asc" ? result : -result;
    });
  }, [detections, filters, sortKey, sortDirection]);

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: DetectionSortKey) => {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "detectedAt" || key === "confidence" ? "desc" : "asc");
    }
  };

  const handleExport = () =>
    downloadCsv("detections.csv", [
      ["ID", "License plate", "Vehicle type", "Camera ID", "Location", "Detected at (UTC)", "Confidence"],
      ...rows.map((d) => [d.id, d.plate, d.vehicleType, d.cameraId, d.location, d.detectedAt, d.confidence]),
    ]);

  return (
    <>
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-2">
            <span className="block text-xs font-medium">License plate</span>
            <SearchInput value={filters.query} onChange={(query) => updateFilters({ query })} placeholder="Search by plate, e.g. BKL-2847" label="Search by license plate" />
          </div>
          <Select
            label="Vehicle type"
            value={filters.type}
            onChange={(e) => updateFilters({ type: e.target.value })}
            options={[{ value: "all", label: "All types" }, ...VEHICLE_TYPES.map((type) => ({ value: type, label: type }))]}
          />
          <Select
            label="Camera"
            value={filters.camera}
            onChange={(e) => updateFilters({ camera: e.target.value })}
            options={[{ value: "all", label: "All cameras" }, ...cameras.map((camera) => ({ value: camera.id, label: `${camera.id} · ${camera.name}` }))]}
          />
          <Input type="date" label="Date" value={filters.date} onChange={(e) => updateFilters({ date: e.target.value })} />
          <Select label="Confidence" value={filters.minConfidence} onChange={(e) => updateFilters({ minConfidence: e.target.value })} options={CONFIDENCE_OPTIONS} />
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button icon={faRotateLeft} onClick={() => { setFilters({ ...initialFilters, query: "" }); setPage(1); }}>
            Reset filters
          </Button>
          <Button variant="primary" icon={faDownload} onClick={handleExport} disabled={rows.length === 0}>
            Export CSV
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState title="No detections match these filters" description="Try a different plate number, or reset the filters to see every record." />
        ) : (
          <>
            <DetectionTable detections={pageRows} sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} onSelect={setSelected} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} />
          </>
        )}
      </Card>

      <DetectionDetailDrawer detection={selected} onClose={() => setSelected(null)} />
    </>
  );
}
