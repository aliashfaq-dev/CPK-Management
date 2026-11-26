"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { faCarSide, faXmark } from "@fortawesome/free-solid-svg-icons";
import type { Camera, Detection, DetectionFilters, Page, Vehicle } from "@/types";
import { PlateTag } from "@/components/detections/PlateTag";
import { VehicleThumbnail } from "@/components/detections/VehicleThumbnail";
import { AssistantChat } from "@/components/ui/AssistantChat";
import { Button } from "@/components/ui/Button";
import { ChartCard } from "@/components/ui/ChartCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VEHICLE_TYPE_LABELS } from "@/lib/constants";
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

function hasAnyFilter(f: DetectionFilters): boolean {
  return Object.values(f).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== undefined,
  );
}

/** AI-only vehicle finder: Gemini updates URL filter params; vehicle cards, timeline, and camera stats follow. */
export function FindFlagView({
  filters,
  vehicles,
  selected,
  sightings,
  cameraBreakdown,
  cameras,
  sightingsPage,
}: FindFlagViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const push = useCallback(
    (params: URLSearchParams) => {
      const search = params.toString();
      startTransition(() => router.push(search ? `${pathname}?${search}` : pathname));
    },
    [pathname, router],
  );

  const onAiFilterHref = useCallback(
    (href: string) => {
      const qIndex = href.indexOf("?");
      const qs = qIndex >= 0 ? href.slice(qIndex + 1) : "";
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
    },
    [pathname, router],
  );

  const currentParams = (extra: Record<string, string | undefined> = {}) => {
    const params = filtersToParams(filters);
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    return params;
  };

  const cameraById = new Map(cameras.map((camera) => [camera.id, camera]));
  const filtered = hasAnyFilter(filters);

  return (
    <>
      <AssistantChat
        className="mb-6"
        title="Find & inspect a vehicle with AI"
        description='Describe what you remember in English or Roman Urdu (partial/OCR-fuzzy plate, vehicle type, colour, camera, or time) — matching vehicles and their sighting timeline update below.'
        onSearchFilterHref={onAiFilterHref}
      />

      {filtered && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-xs text-muted">Showing vehicles matching the active AI filter.</p>
          <Button
            variant="ghost"
            size="sm"
            icon={faXmark}
            onClick={() => push(new URLSearchParams())}
          >
            Reset to all vehicles
          </Button>
        </div>
      )}

      {vehicles.total === 0 ? (
        <Card>
          <EmptyState
            icon={faCarSide}
            title="No vehicles found"
            description="Only detections with a readable plate are grouped here. Ask a broader question in the AI search box above or reset to view all vehicles."
          />
        </Card>
      ) : (
        <div className={cn("grid gap-4 transition-opacity lg:grid-cols-3", pending && "opacity-60")} aria-busy={pending}>
          <section aria-label="Matched vehicles" className="space-y-3">
            <h2 className="text-sm font-semibold">
              {vehicles.total} vehicle{vehicles.total === 1 ? "" : "s"} found
            </h2>
            {vehicles.rows.map((vehicle, index) => (
              <VehicleCard
                key={vehicle.plateNorm}
                vehicle={vehicle}
                priority={index < 8}
                selected={vehicle.plateNorm === selected?.plateNorm}
                onSelect={() =>
                  push(
                    currentParams({
                      sel: vehicle.plateNorm,
                      sp: undefined,
                      page: vehicles.page > 1 ? String(vehicles.page) : undefined,
                    }),
                  )
                }
              />
            ))}
            {vehicles.total > vehicles.pageSize && (
              <Pagination
                page={vehicles.page}
                pageSize={vehicles.pageSize}
                total={vehicles.total}
                onPageChange={(page) =>
                  push(
                    currentParams({
                      page: page > 1 ? String(page) : undefined,
                      sel: undefined,
                      sp: undefined,
                    }),
                  )
                }
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
                      size={640}
                      natural
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-xs text-muted">Latest plate snapshot</span>
                    <VehicleThumbnail
                      type={selected.type}
                      eventId={selected.latestEventId}
                      hasImage={selected.hasPlateImage}
                      kind="plate"
                      size={320}
                      natural
                      alt={`Plate ${selected.plate} snapshot`}
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
                      onPageChange={(page) =>
                        push(
                          currentParams({
                            sel: selected.plateNorm,
                            sp: page > 1 ? String(page) : undefined,
                            page: vehicles.page > 1 ? String(vehicles.page) : undefined,
                          }),
                        )
                      }
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
                              {camera?.location && camera.location !== "Location unavailable" ? `${camera.location} · ` : ""}
                              {count} detection{count === 1 ? "" : "s"}
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
