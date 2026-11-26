import type { Metadata } from "next";
import { FindFlagView } from "@/components/find-flag/FindFlagView";
import { AssistantChat } from "@/components/ui/AssistantChat";
import { PageHeader } from "@/components/ui/PageHeader";
import { PAGE_SIZE } from "@/lib/constants";
import { getCameras, getDetectionsPage, getVehicleCameraBreakdown, getVehiclesPage } from "@/lib/data-service";
import { normalizePlate, parseFilters, type RawParams } from "@/lib/detection-query";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Find Flag" };

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function toPage(value: string | string[] | undefined): number {
  return Math.max(1, Math.floor(Number(single(value))) || 1);
}

export default async function FindFlagPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const cameras = await getCameras();
  const vehicles = await getVehiclesPage(filters, toPage(params.page), PAGE_SIZE);

  const requested = normalizePlate(single(params.sel));
  const selected =
    vehicles.rows.find((vehicle) => vehicle.plateNorm === requested) ??
    (requested ? (await getVehiclesPage({ ...filters, plate: undefined, plateExact: requested }, 1, 1)).rows[0] : undefined) ??
    vehicles.rows[0] ??
    null;

  const sightingFilters = { ...filters, plate: undefined, plateExact: selected?.plateNorm };
  const [sightings, cameraBreakdown] = selected
    ? await Promise.all([
        getDetectionsPage({ ...sightingFilters, page: toPage(params.sp), pageSize: PAGE_SIZE, sort: "detectedAt", dir: "desc" }),
        getVehicleCameraBreakdown(selected.plateNorm, filters),
      ])
    : [null, []];

  return (
    <>
      <PageHeader description="Locate a vehicle by plate, type, camera, or time range and review where it was detected." />
      <AssistantChat className="mb-6" title="Describe the vehicle you want to flag" description="Tell the assistant what you remember: part of the plate, colour, type, camera, or time." />
      <FindFlagView
        filters={filters}
        vehicles={vehicles}
        selected={selected}
        sightings={sightings}
        cameraBreakdown={cameraBreakdown}
        cameras={cameras}
        sightingsPage={sightings?.page ?? 1}
      />
    </>
  );
}
