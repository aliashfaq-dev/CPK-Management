import Link from "next/link";
import type { Camera } from "@/types";
import { ChartCard } from "@/components/ui/ChartCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/utils";

export function CameraStatusPanel({ cameras }: { cameras: Camera[] }) {
  return (
    <ChartCard
      title="Camera status"
      description="Health of every monitored location"
      bodyClassName="p-0"
      action={
        <Link href="/live-camera" className="text-sm font-medium text-accent hover:underline">
          Open live view
        </Link>
      }
    >
      <ul className="divide-y divide-line">
        {cameras.map((camera) => (
          <li key={camera.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{camera.name}</p>
              <p className="truncate text-xs text-muted">
                {camera.location} · Last activity {formatDateTime(camera.lastActivity)}
              </p>
            </div>
            <StatusBadge status={camera.status} />
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
