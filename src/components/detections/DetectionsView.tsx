"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { faDownload, faRotateLeft } from "@fortawesome/free-solid-svg-icons";
import type { Camera, Detection, DetectionQuery, DetectionSortKey, Page } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { VEHICLE_TYPES, VEHICLE_TYPE_LABELS } from "@/lib/constants";
import { filtersToParams } from "@/lib/detection-query";
import { cn } from "@/lib/utils";
import { DetectionDetailDrawer } from "./DetectionDetailDrawer";
import { DetectionTable } from "./DetectionTable";
import { useState } from "react";

const CONFIDENCE_OPTIONS = [
  { value: "0", label: "Any confidence" },
  { value: "90", label: "90% or higher" },
  { value: "95", label: "95% or higher" },
  { value: "98", label: "98% or higher" },
];

interface DetectionsViewProps {
  result: Page<Detection>;
  query: DetectionQuery;
  cameras: Camera[];
  colours: string[];
}

/** Filters, sorting and paging live in the URL; the server returns exactly one page. */
export function DetectionsView({ result, query, cameras, colours }: DetectionsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Detection | null>(null);

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

  return (
    <>
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-2">
            <span className="block text-xs font-medium">License plate</span>
            <SearchInput
              value={query.plate ?? ""}
              onChange={(plate) => navigate({ plate: plate.trim() || undefined })}
              placeholder="Search by plate, e.g. BKL-2847"
              label="Search by license plate"
            />
          </div>
          <Select
            label="Vehicle type"
            value={query.type ?? "all"}
            onChange={(e) => navigate({ type: e.target.value === "all" ? undefined : (e.target.value as DetectionQuery["type"]) })}
            options={[{ value: "all", label: "All types" }, ...VEHICLE_TYPES.map((type) => ({ value: type, label: VEHICLE_TYPE_LABELS[type] }))]}
          />
          <Select
            label="Camera"
            value={query.camera ?? "all"}
            onChange={(e) => navigate({ camera: e.target.value === "all" ? undefined : e.target.value })}
            options={[{ value: "all", label: "All cameras" }, ...cameras.map((camera) => ({ value: camera.id, label: `${camera.id} · ${camera.name}` }))]}
          />
          <Input type="date" label="From (UTC)" value={query.from?.slice(0, 10) ?? ""} onChange={(e) => navigate({ from: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined })} />
          <Input
            type="date"
            label="To (UTC)"
            value={query.to ? new Date(Date.parse(query.to) - 86_400_000).toISOString().slice(0, 10) : ""}
            onChange={(e) => navigate({ to: e.target.value ? new Date(Date.parse(`${e.target.value}T00:00:00Z`) + 86_400_000).toISOString() : undefined })}
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Select label="Confidence" value={String(query.minConfidence ?? 0)} onChange={(e) => navigate({ minConfidence: Number(e.target.value) || undefined })} options={CONFIDENCE_OPTIONS} />
          <Select
            label="Plate"
            value={query.hasPlate === undefined ? "all" : query.hasPlate ? "yes" : "no"}
            onChange={(e) => navigate({ hasPlate: e.target.value === "all" ? undefined : e.target.value === "yes" })}
            options={[
              { value: "all", label: "With or without plate" },
              { value: "yes", label: "Plate read" },
              { value: "no", label: "No plate read" },
            ]}
          />
          <Select
            label="Colour"
            value={query.colour ?? "all"}
            onChange={(e) => navigate({ colour: e.target.value === "all" ? undefined : e.target.value })}
            options={[{ value: "all", label: colours.length ? "Any colour" : "Any colour (analysis pending)" }, ...colours.map((colour) => ({ value: colour, label: colour }))]}
          />
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button icon={faRotateLeft} onClick={() => startTransition(() => router.push(pathname))}>
            Reset filters
          </Button>
          <Button variant="primary" icon={faDownload} onClick={() => window.location.assign(exportHref)} disabled={result.total === 0}>
            Export CSV
          </Button>
        </div>
      </Card>

      <Card className={cn("overflow-hidden transition-opacity", pending && "opacity-60")} aria-busy={pending}>
        {result.total === 0 ? (
          <EmptyState title="No detections match these filters" description="Try a different plate number, or reset the filters to see every record." />
        ) : (
          <>
            <DetectionTable detections={result.rows} sortKey={query.sort} sortDirection={query.dir} onSort={handleSort} onSelect={setSelected} />
            <Pagination page={result.page} pageSize={result.pageSize} total={result.total} onPageChange={(page) => navigate({ page })} />
          </>
        )}
      </Card>

      <DetectionDetailDrawer detection={selected} onClose={() => setSelected(null)} />
    </>
  );
}
