"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { faImage, faMagnifyingGlass, faRotateLeft, faUpload, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Camera, Detection, Vehicle } from "@/types";
import { PlateTag } from "@/components/detections/PlateTag";
import { Button } from "@/components/ui/Button";
import { ChartCard } from "@/components/ui/ChartCard";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VEHICLE_TYPES } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { DetectionTimeline } from "./DetectionTimeline";
import { VehicleCard } from "./VehicleCard";

interface Criteria {
  plate: string;
  type: string;
  camera: string;
  from: string;
  to: string;
}

interface Match {
  vehicle: Vehicle;
  sightings: Detection[];
}

const EMPTY: Criteria = { plate: "", type: "all", camera: "all", from: "", to: "" };

function runSearch(criteria: Criteria, hasImage: boolean, vehicles: Vehicle[], detections: Detection[]): Match[] {
  const plate = criteria.plate.replace(/[\s-]/g, "").toLowerCase();
  const from = criteria.from ? Date.parse(`${criteria.from}:00Z`) : null;
  const to = criteria.to ? Date.parse(`${criteria.to}:59Z`) : null;

  const matches = vehicles
    .filter(
      (vehicle) =>
        (!plate || vehicle.plate.replace("-", "").toLowerCase().includes(plate)) &&
        (criteria.type === "all" || vehicle.type === criteria.type),
    )
    .map((vehicle) => ({
      vehicle,
      sightings: detections.filter((d) => {
        const time = Date.parse(d.detectedAt);
        return (
          d.plate === vehicle.plate &&
          (criteria.camera === "all" || d.cameraId === criteria.camera) &&
          (from === null || time >= from) &&
          (to === null || time <= to)
        );
      }),
    }))
    .filter((match) => match.sightings.length > 0)
    .sort((a, b) => b.sightings.length - a.sightings.length);

  const noTextCriteria = !plate && criteria.type === "all" && criteria.camera === "all" && from === null && to === null;
  // Image recognition is not implemented: an image-only search returns sample vehicles.
  return hasImage && noTextCriteria ? matches.slice(0, 3) : matches;
}

export function FindFlagView({ vehicles, detections, cameras }: { vehicles: Vehicle[]; detections: Detection[]; cameras: Camera[] }) {
  const [criteria, setCriteria] = useState<Criteria>(EMPTY);
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [results, setResults] = useState<Match[] | null>(null);
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);

  const update = (patch: Partial<Criteria>) => setCriteria((current) => ({ ...current, ...patch }));

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
    const found = runSearch(criteria, image !== null, vehicles, detections);
    setResults(found);
    setSelectedPlate(found[0]?.vehicle.plate ?? null);
  };

  const onReset = () => {
    setCriteria(EMPTY);
    clearImage();
    setResults(null);
    setSelectedPlate(null);
  };

  const selected = results?.find((match) => match.vehicle.plate === selectedPlate) ?? results?.[0];
  const cameraSummary = selected
    ? Array.from(
        selected.sightings.reduce((map, d) => map.set(d.cameraId, (map.get(d.cameraId) ?? 0) + 1), new Map<string, number>()),
      ).map(([id, count]) => ({ camera: cameras.find((c) => c.id === id), count }))
    : [];

  return (
    <>
      <Card className="mb-6">
        <form onSubmit={onSubmit} className="grid gap-5 p-5 lg:grid-cols-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
            <Input label="License plate" placeholder="e.g. BKL-2847" value={criteria.plate} onChange={(e) => update({ plate: e.target.value })} />
            <Select
              label="Vehicle type"
              value={criteria.type}
              onChange={(e) => update({ type: e.target.value })}
              options={[{ value: "all", label: "Any type" }, ...VEHICLE_TYPES.map((type) => ({ value: type, label: type }))]}
            />
            <Input type="datetime-local" label="From (UTC)" value={criteria.from} onChange={(e) => update({ from: e.target.value })} />
            <Input type="datetime-local" label="To (UTC)" value={criteria.to} onChange={(e) => update({ to: e.target.value })} />
            <div className="sm:col-span-2">
              <Select
                label="Camera"
                value={criteria.camera}
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
            <p className="text-xs text-muted">Image matching is not connected yet. An uploaded image is previewed and returns sample matches.</p>
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

      {results === null ? (
        <Card>
          <EmptyState icon={faImage} title="Search for a vehicle" description="Enter a plate, pick a camera or time range, or upload an image to see matching vehicles and where they were detected." />
        </Card>
      ) : results.length === 0 ? (
        <Card>
          <EmptyState title="No vehicles found" description="Check the plate number, widen the time range, or choose Any camera." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <section aria-label="Search results" className="space-y-3">
            <h2 className="text-sm font-semibold">
              {results.length} vehicle{results.length === 1 ? "" : "s"} found
            </h2>
            {results.map((match) => (
              <VehicleCard
                key={match.vehicle.plate}
                vehicle={match.vehicle}
                matches={match.sightings.length}
                selected={match.vehicle.plate === selected?.vehicle.plate}
                onSelect={() => setSelectedPlate(match.vehicle.plate)}
              />
            ))}
          </section>

          {selected && (
            <div className="space-y-4 lg:col-span-2">
              <ChartCard title="Vehicle information" action={<PlateTag plate={selected.vehicle.plate} />}>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                  {[
                    ["Type", selected.vehicle.type],
                    ["Make and model", selected.vehicle.make],
                    ["Color", selected.vehicle.color],
                    ["Total sightings", String(selected.vehicle.totalSightings)],
                    ["First seen", formatDateTime(selected.vehicle.firstSeen)],
                    ["Last seen", formatDateTime(selected.vehicle.lastSeen)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted">{label}</dt>
                      <dd className="mt-0.5 font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </ChartCard>

              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard title="Detection timeline" description={`${selected.sightings.length} matching detections`}>
                  <DetectionTimeline detections={selected.sightings} />
                </ChartCard>
                <ChartCard title="Cameras and locations" description="Where this vehicle was seen" bodyClassName="p-0">
                  <ul className="divide-y divide-line">
                    {cameraSummary.map(({ camera, count }) => (
                      <li key={camera?.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{camera?.name ?? "Unknown camera"}</p>
                          <p className="truncate text-xs text-muted">
                            {camera?.location} · {count} detection{count === 1 ? "" : "s"}
                          </p>
                        </div>
                        {camera && <StatusBadge status={camera.status} />}
                      </li>
                    ))}
                  </ul>
                </ChartCard>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
