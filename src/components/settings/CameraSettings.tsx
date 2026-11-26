"use client";

import { faVideoSlash } from "@fortawesome/free-solid-svg-icons";
import type { Camera } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/utils";
import { SettingsSection } from "./SettingsSection";

/** Cameras registered in the database. Stream control arrives in the pipeline phase. */
export function CameraSettings({ initialCameras }: { initialCameras: Camera[] }) {
  return (
    <SettingsSection title="Cameras" description="Cameras registered in the database.">
      {initialCameras.length === 0 ? (
        <div className="rounded-lg border border-line">
          <EmptyState icon={faVideoSlash} title="No cameras yet" description="Cameras appear here once the detection pipeline registers them." />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle text-xs text-muted">
                {["Camera", "Location", "Last activity", "Status"].map((label) => (
                  <th key={label} scope="col" className="px-4 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {initialCameras.map((camera) => (
                <tr key={camera.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{camera.name}</span> <span className="text-xs text-muted">{camera.id}</span>
                  </td>
                  <td className="px-4 py-3 text-muted">{camera.location}</td>
                  <td className="px-4 py-3 text-muted">{camera.lastActivity ? formatDateTime(camera.lastActivity) : "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={camera.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SettingsSection>
  );
}
