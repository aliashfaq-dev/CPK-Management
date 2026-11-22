"use client";

import { useState } from "react";
import { faExpand, faGrip, faSquare, faXmark } from "@fortawesome/free-solid-svg-icons";
import type { Camera, CameraStatus, Detection } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toggle } from "@/components/ui/Toggle";
import { useEscape } from "@/hooks/useEscape";
import { cn, formatDateTime } from "@/lib/utils";
import { CameraFeed } from "./CameraFeed";
import { CameraGrid } from "./CameraGrid";
import { RecentDetectionsPanel } from "./RecentDetectionsPanel";

type ViewMode = "grid" | "single";
type StatusFilter = "all" | CameraStatus;

const STATUS_OPTIONS = [
  { value: "all", label: "All cameras" },
  { value: "online", label: "Online" },
  { value: "warning", label: "Warning" },
  { value: "offline", label: "Offline" },
];

export function LiveCameraView({ cameras, detections }: { cameras: Camera[]; detections: Detection[] }) {
  const [view, setView] = useState<ViewMode>("grid");
  const [selectedId, setSelectedId] = useState(cameras[0]?.id ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showOverlay, setShowOverlay] = useState(true);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);

  useEscape(fullscreenId !== null, () => setFullscreenId(null));

  const visible = cameras.filter((c) => statusFilter === "all" || c.status === statusFilter);
  const selected = cameras.find((c) => c.id === selectedId) ?? cameras[0];
  const fullscreen = cameras.find((c) => c.id === fullscreenId);
  const detectionsFor = (id: string) => detections.filter((d) => d.cameraId === id);
  const sidebarDetections = (view === "single" && selected ? detectionsFor(selected.id) : detections).slice(0, 8);

  return (
    <>
      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div role="group" aria-label="View mode" className="flex gap-1 rounded-md border border-line p-1">
              {([["grid", "Grid", faGrip], ["single", "Single", faSquare]] as const).map(([mode, label, icon]) => (
                <Button key={mode} size="sm" variant={view === mode ? "primary" : "ghost"} icon={icon} aria-pressed={view === mode} onClick={() => setView(mode)}>
                  {label}
                </Button>
              ))}
            </div>
            <div className="w-44">
              <Select label="Status filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} options={STATUS_OPTIONS} />
            </div>
            {view === "single" && (
              <div className="w-56">
                <Select label="Camera" value={selected?.id} onChange={(e) => setSelectedId(e.target.value)} options={cameras.map((c) => ({ value: c.id, label: `${c.id} · ${c.name}` }))} />
              </div>
            )}
          </div>
          <div className="w-full lg:w-56">
            <Toggle label="Detection overlay" checked={showOverlay} onChange={setShowOverlay} />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          {view === "grid" ? (
            <CameraGrid cameras={visible} detections={detections} selectedId={selected?.id ?? ""} showOverlay={showOverlay} onSelect={setSelectedId} onFullscreen={setFullscreenId} />
          ) : (
            selected && (
              <div className="space-y-4">
                <Card className="overflow-hidden">
                  <CameraFeed camera={selected} detections={detectionsFor(selected.id)} showOverlay={showOverlay} />
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
                    <div>
                      <p className="text-sm font-semibold">{selected.name}</p>
                      <p className="text-xs text-muted">{selected.location}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={selected.status} />
                      <Button icon={faExpand} onClick={() => setFullscreenId(selected.id)}>
                        Fullscreen
                      </Button>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-4 border-t border-line p-4 text-sm sm:grid-cols-4">
                    {[
                      ["Resolution", selected.resolution],
                      ["Frame rate", selected.fps ? `${selected.fps} fps` : "—"],
                      ["Detections today", String(selected.detectionsToday)],
                      ["Last activity", formatDateTime(selected.lastActivity)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted">{label}</dt>
                        <dd className="mt-0.5 font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
                <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Switch camera">
                  {visible.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={c.id === selected.id}
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "shrink-0 rounded-md border px-3 py-2 text-left text-xs transition-colors",
                        c.id === selected.id ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-muted hover:bg-subtle",
                      )}
                    >
                      <span className="block font-medium">{c.id}</span>
                      <span className="block">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        <RecentDetectionsPanel
          detections={sidebarDetections}
          title={view === "single" && selected ? selected.name : "All cameras"}
        />
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-feed p-3 text-white sm:p-4" role="dialog" aria-modal="true" aria-label={`${fullscreen.name} fullscreen view`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{fullscreen.name}</p>
              <p className="truncate text-xs text-white/60">
                {fullscreen.id} · {fullscreen.location} · {fullscreen.resolution}
              </p>
            </div>
            <Button variant="secondary" icon={faXmark} onClick={() => setFullscreenId(null)}>
              Exit fullscreen
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <CameraFeed camera={fullscreen} detections={detectionsFor(fullscreen.id)} showOverlay={showOverlay} fill />
          </div>
        </div>
      )}
    </>
  );
}
