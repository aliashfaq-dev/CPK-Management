"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { faImage, faMagnifyingGlass, faRotateLeft, faUpload, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Camera, Detection, DetectionFilters, Page, Vehicle } from "@/types";
import { PlateTag } from "@/components/detections/PlateTag";
import { VehicleThumbnail } from "@/components/detections/VehicleThumbnail";
import { Button } from "@/components/ui/Button";
import { ChartCard } from "@/components/ui/ChartCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VEHICLE_TYPES, VEHICLE_TYPE_LABELS } from "@/lib/constants";
import { filtersToParams } from "@/lib/detection-query";
import { cn, formatDateTime, vehicleDescription } from "@/lib/utils";
import { DetectionTimeline } from "./DetectionTimeline";
import { VehicleCard } from "./VehicleCard";

interface FindFlagViewProps {
  filters: DetectionFilters;
  vehicles: Page<Vehicle>;
  selected: Vehicle | null;
  sightings: Page<Detection> | null;
  cameraBreakdown: Array<{ cameraId: string; count: number }>;
  cameras: Camera[];
  sightingsPage: number;
}

/** Search criteria, the selected vehicle and both page numbers live in the URL. */
export function FindFlagView({ filters, vehicles, selected, sightings, cameraBreakdown, cameras, sightingsPage }: FindFlagViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState({
    plate: filters.plate ?? "",
    type: filters.type ?? "all",
    camera: filters.camera ?? "all",
    from: filters.from?.slice(0, 10) ?? "",
    to: filters.to ? new Date(Date.parse(filters.to) - 86_400_000).toISOString().slice(0, 10) : "",
  });
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);

  // Revoke the preview URL when the page unmounts (replace/clear are handled below).
  const imageUrlRef = useRef<string | null>(null);
  useEffect(() => {
    imageUrlRef.current = image?.url ?? null;
  }, [image]);
  useEffect(() => () => {
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
  }, []);

  const update = (patch: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...patch }));

  const push = (params: URLSearchParams) => {
    const search = params.toString();
    startTransition(() => router.push(search ? `${pathname}?${search}` : pathname));
  };

  const currentParams = (extra: Record<string, string | undefined> = {}) => {
    const params = filtersToParams(filters);
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    return params;
  };

  const onImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (image) URL.revokeObjectURL(image.url);
    setImage(file ? { url: URL.createObjectURL(file), name: file.name } : null);
  };

  const clearImage = () => {
    if (image) URL.revokeObjectURL(image.url);
    setImage(null);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (draft.plate.trim()) params.set("q", draft.plate.trim());
    if (draft.type !== "all") params.set("type", draft.type);
    if (draft.camera !== "all") params.set("camera", draft.camera);
    if (draft.from) params.set("from", draft.from);
    if (draft.to) params.set("to", draft.to);
    push(params);
  };

  const onReset = () => {
    setDraft({ plate: "", type: "all", camera: "all", from: "", to: "" });
    clearImage();
    push(new URLSearchParams());
  };

  const cameraById = new Map(cameras.map((camera) => [camera.id, camera]));

  return (
    <>
      <Card className="mb-6">
        <form onSubmit={onSubmit} className="grid gap-5 p-5 lg:grid-cols-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
            <Input label="License plate" placeholder="e.g. BKL-2847" value={draft.plate} onChange={(e) => update({ plate: e.target.value })} />
            <Select
              label="Vehicle type"
              value={draft.type}
              onChange={(e) => update({ type: e.target.value })}
              options={[{ value: "all", label: "Any type" }, ...VEHICLE_TYPES.map((type) => ({ value: type, label: VEHICLE_TYPE_LABELS[type] }))]}
            />
            <Input type="date" label="From (UTC)" value={draft.from} onChange={(e) => update({ from: e.target.value })} />
            <Input type="date" label="To (UTC)" value={draft.to} onChange={(e) => update({ to: e.target.value })} />
            <div className="sm:col-span-2">
              <Select
                label="Camera"
                value={draft.camera}
                onChange={(e) => update({ camera: e.target.value })}
                options={[{ value: "all", label: "Any camera" }, ...cameras.map((c) => ({ value: c.id, label: `${c.id} · ${c.name}` }))]}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-medium">Vehicle image</span>
            {image ? (
              <div className="relative overflow-hidden rounded-md border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={`Preview of ${image.name}`} className="h-40 w-full object-cover" />
                <Button variant="secondary" size="icon" icon={faXmark} aria-label="Remove image" onClick={clearImage} className="absolute right-2 top-2" />
              </div>
            ) : (
              <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-strong bg-subtle text-center text-sm text-muted focus-within:outline-2 focus-within:outline-accent hover:bg-accent-soft">
                <FontAwesomeIcon icon={faUpload} />
                <span className="font-medium text-fg">Upload a vehicle image</span>
                <span className="text-xs">PNG or JPG</span>
                <input type="file" accept="image/*" className="sr-only" onChange={onImageChange} />
              </label>
            )}
            <p className="text-xs text-muted">Image matching is not connected. An uploaded image is only previewed; it is not used in the search.</p>
          </div>

          <div className="flex flex-wrap justify-end gap-2 lg:col-span-3">
            <Button icon={faRotateLeft} onClick={onReset}>
              Clear search
            </Button>
            <Button type="submit" variant="primary" icon={faMagnifyingGlass}>
              Search vehicles
            </Button>
          </div>
        </form>
      </Card>

      {vehicles.total === 0 ? (
        <Card>
          <EmptyState icon={faImage} title="No vehicles found" description="Only detections with a readable plate are listed. Check the plate number, widen the time range, or choose Any camera." />
        </Card>
      ) : (
        <div className={cn("grid gap-4 transition-opacity lg:grid-cols-3", pending && "opacity-60")} aria-busy={pending}>
          <section aria-label="Search results" className="space-y-3">
            <h2 className="text-sm font-semibold">
              {vehicles.total} vehicle{vehicles.total === 1 ? "" : "s"} found
            </h2>
            {vehicles.rows.map((vehicle) => (
              <VehicleCard
                key={vehicle.plateNorm}
                vehicle={vehicle}
                selected={vehicle.plateNorm === selected?.plateNorm}
                onSelect={() => push(currentParams({ sel: vehicle.plateNorm, sp: undefined, page: vehicles.page > 1 ? String(vehicles.page) : undefined }))}
              />
            ))}
            {vehicles.total > vehicles.pageSize && (
              <Pagination
                page={vehicles.page}
                pageSize={vehicles.pageSize}
                total={vehicles.total}
                onPageChange={(page) => push(currentParams({ page: page > 1 ? String(page) : undefined, sel: undefined, sp: undefined }))}
              />
            )}
          </section>

          {selected && (
            <div className="space-y-4 lg:col-span-2">
              <ChartCard title="Vehicle information" action={<PlateTag plate={selected.plate} />}>
                <div className="mb-5 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <span className="block text-xs text-muted">Latest vehicle snapshot</span>
                    <VehicleThumbnail
                      type={selected.type}
                      eventId={selected.latestEventId}
                      hasImage={selected.hasVehicleImage}
                      kind="vehicle"
                      className="aspect-video h-auto w-full rounded-md text-2xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-xs text-muted">Latest plate snapshot</span>
                    <VehicleThumbnail
                      type={selected.type}
                      eventId={selected.latestEventId}
                      hasImage={selected.hasPlateImage}
                      kind="plate"
                      alt={`Plate ${selected.plate} snapshot`}
                      className="aspect-video h-auto w-full rounded-md text-2xl"
                    />
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                  {[
                    ["Type", VEHICLE_TYPE_LABELS[selected.type] ?? selected.type],
                    ["Make and model", selected.make ?? "Not analysed yet"],
                    ["Colour", selected.color ?? "Not analysed yet"],
                    ["Total sightings", String(selected.totalSightings)],
                    ["First seen", formatDateTime(selected.firstSeen)],
                    ["Last seen", formatDateTime(selected.lastSeen)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted">{label}</dt>
                      <dd className="mt-0.5 font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </ChartCard>

              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard title="Detection timeline" description={`${sightings?.total ?? 0} matching detections`} bodyClassName="p-0">
                  <div className="p-5">
                    <DetectionTimeline detections={sightings?.rows ?? []} />
                  </div>
                  {sightings && sightings.total > sightings.pageSize && (
                    <Pagination
                      page={sightings.page}
                      pageSize={sightings.pageSize}
                      total={sightings.total}
                      onPageChange={(page) => push(currentParams({ sel: selected.plateNorm, sp: page > 1 ? String(page) : undefined, page: vehicles.page > 1 ? String(vehicles.page) : undefined }))}
                    />
                  )}
                  <span className="sr-only">Sightings page {sightingsPage}</span>
                </ChartCard>
                <ChartCard title="Cameras and locations" description="Where this vehicle was seen" bodyClassName="p-0">
                  <ul className="divide-y divide-line">
                    {cameraBreakdown.map(({ cameraId, count }) => {
                      const camera = cameraById.get(cameraId);
                      return (
                        <li key={cameraId} className="flex items-center justify-between gap-3 px-5 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{camera?.name ?? cameraId ?? "Unknown camera"}</p>
                            <p className="truncate text-xs text-muted">
                              {camera?.location ?? "Location unavailable"} · {count} detection{count === 1 ? "" : "s"}
                            </p>
                          </div>
                          {camera && <StatusBadge status={camera.status} />}
                        </li>
                      );
                    })}
                  </ul>
                </ChartCard>
              </div>
              <p className="sr-only">{vehicleDescription(selected.color, selected.make)}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
