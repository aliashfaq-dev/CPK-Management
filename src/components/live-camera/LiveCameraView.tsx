"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { faListUl, faPlus, faVideoSlash, faXmark } from "@fortawesome/free-solid-svg-icons";
import type { Camera, CameraStatus, Detection, WorkspaceTab } from "@/types";
import { PlateTag } from "@/components/detections/PlateTag";
import { VehicleThumbnail } from "@/components/detections/VehicleThumbnail";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { useEscape } from "@/hooks/useEscape";
import { useLiveDetectionSubscription } from "@/hooks/useLiveEvents";
import { matchesCamera, sortByCameraNumber } from "@/lib/cameras";
import { VEHICLE_TYPE_LABELS } from "@/lib/constants";
import { formatTimeWithSeconds } from "@/lib/utils";
const FullscreenCameraModal = dynamic(
  () => import("./FullscreenCameraModal").then((module) => module.FullscreenCameraModal),
  {
    ssr: false,
    loading: () => <div className="fixed inset-0 z-50 animate-pulse bg-feed" aria-label="Opening fullscreen camera" />,
  },
);
import { CameraGrid, MAX_GRID_SIZE, fitGridSize } from "./CameraGrid";
import { EmptyTabPicker } from "./EmptyTabPicker";
import { WorkspaceTabs } from "./WorkspaceTabs";

type StatusFilter = "all" | CameraStatus;

const STATUS_OPTIONS = [
  { value: "all", label: "All cameras" },
  { value: "online", label: "Online" },
  { value: "warning", label: "Warning" },
  { value: "offline", label: "Offline" },
];

const DEFAULT_PER_SCREEN = MAX_GRID_SIZE;
const MAX_TABS = 20;
const HOME_ID = "home";
const HOME_TAB: WorkspaceTab = { id: HOME_ID, title: "All cameras", cameraIds: [], pinned: true };

interface LiveCameraViewProps {
  cameras: Camera[];
  detections: Detection[];
}

export function LiveCameraView({ cameras: initialCameras, detections: initialDetections }: LiveCameraViewProps) {
  const [cameras, setCameras] = useState<Camera[]>(initialCameras);
  const [detections, setDetections] = useState<Detection[]>(initialDetections);
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeId, setActiveId] = useState(HOME_ID);
  const [perScreen, setPerScreen] = useState<number>(DEFAULT_PER_SCREEN);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showOverlay, setShowOverlay] = useState(true);
  const [showRecent, setShowRecent] = useState(true);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const nextTabNumber = useRef(1);

  useEffect(() => setCameras(initialCameras), [initialCameras]);
  useEffect(() => setDetections(initialDetections), [initialDetections]);

  useLiveDetectionSubscription(({ detection, isUpdate }) => {
    setDetections((current) => {
      if (isUpdate || current.some((item) => item.id === detection.id)) {
        return current.map((item) => (item.id === detection.id ? detection : item));
      }
      return [detection, ...current].slice(0, 150);
    });
    if (!isUpdate && detection.cameraId) {
      setCameras((current) =>
        current.map((camera) =>
          camera.id === detection.cameraId
            ? {
                ...camera,
                status: "online",
                lastActivity: detection.detectedAt || new Date().toISOString(),
                detectionsToday: camera.detectionsToday + 1,
              }
            : camera,
        ),
      );
    }
  });

  const closeFullscreen = useCallback(() => setFullscreenId(null), []);
  useEscape(fullscreenId !== null, closeFullscreen);

  const cameraById = useMemo(() => new Map(cameras.map((camera) => [camera.id, camera])), [cameras]);

  const detectionsByCamera = useMemo(() => {
    const map = new Map<string, Detection[]>();
    for (const detection of detections) {
      const list = map.get(detection.cameraId);
      if (list) list.push(detection);
      else map.set(detection.cameraId, [detection]);
    }
    return map;
  }, [detections]);

  const activeTab = tabs.find((tab) => tab.id === activeId);
  const showTabs = tabs.length > 0;
  const isEmptyTab = activeTab !== undefined && activeTab.cameraIds.length === 0;
  const barTabs = useMemo(() => [HOME_TAB, ...tabs], [tabs]);

  const sourceCameras = useMemo(
    () => (activeTab ? activeTab.cameraIds.flatMap((id) => cameraById.get(id) ?? []) : cameras),
    [activeTab, cameraById, cameras],
  );

  const filtered = useMemo(
    () => sortByCameraNumber(sourceCameras.filter((camera) => (statusFilter === "all" || camera.status === statusFilter) && matchesCamera(camera, query))),
    [sourceCameras, statusFilter, query],
  );

  const maxPerScreen = isEmptyTab ? MAX_GRID_SIZE : Math.min(Math.max(filtered.length, 1), MAX_GRID_SIZE);
  const perScreenOptions = useMemo(
    () => Array.from({ length: maxPerScreen }, (_, i) => i + 1).map((n) => ({ value: String(n), label: `Show: ${n} ${n === 1 ? "camera" : "cameras"}` })),
    [maxPerScreen],
  );
  const effectivePerScreen = Math.min(perScreen, maxPerScreen);
  const visible = useMemo(() => filtered.slice(0, effectivePerScreen), [filtered, effectivePerScreen]);
  const visibleIds = useMemo(() => new Set(visible.map((c) => c.id)), [visible]);
  const recentForVisible = useMemo(
    () => detections.filter((d) => visibleIds.size === 0 || visibleIds.has(d.cameraId)).slice(0, 25),
    [detections, visibleIds],
  );
  const fullscreen = fullscreenId ? cameraById.get(fullscreenId) : undefined;

  const selectTab = useCallback((id: string) => setActiveId(id), []);

  const addTab = useCallback(() => {
    if (tabs.length >= MAX_TABS) return;
    const id = `w${nextTabNumber.current++}`;
    setTabs([...tabs, { id, title: "New View", cameraIds: [] }]);
    setActiveId(id);
  }, [tabs]);

  const closeTab = useCallback(
    (id: string) => {
      const index = tabs.findIndex((tab) => tab.id === id);
      if (index < 0) return;
      const remaining = tabs.filter((tab) => tab.id !== id);
      setTabs(remaining);
      if (id === activeId) setActiveId(remaining[Math.min(index, remaining.length - 1)]?.id ?? HOME_ID);
    },
    [tabs, activeId],
  );

  const assignCameras = useCallback(
    (ids: string[]) => {
      const first = cameraById.get(ids[0]);
      const title = first ? (ids.length > 1 ? `${first.name} +${ids.length - 1}` : first.name) : "New View";
      setTabs((current) => current.map((tab) => (tab.id === activeId ? { ...tab, cameraIds: ids, title } : tab)));
      setQuery("");
      setStatusFilter("all");
    },
    [activeId, cameraById],
  );

  const clearFilters = useCallback(() => {
    setQuery("");
    setStatusFilter("all");
  }, []);

  return (
    <>
      <div className="flex h-[calc(100dvh-6rem)] min-h-0 flex-col gap-3 md:h-[calc(100dvh-7rem)]">
        <Card className="shrink-0">
          <div className="flex flex-wrap items-center gap-3 p-3">
            <SearchInput
              value={query}
              onChange={setQuery}
              label="Filter this tab by area or camera name"
              placeholder="Filter this tab: area or camera"
              className="w-full sm:w-72"
            />
            <div className="w-40">
              <Select aria-label="Status filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} options={STATUS_OPTIONS} />
            </div>
            <div className="w-44">
              <Select
                aria-label="Cameras per screen"
                value={String(effectivePerScreen)}
                onChange={(e) => setPerScreen(Number(e.target.value))}
                options={perScreenOptions}
              />
            </div>
            <p className="text-xs text-muted" aria-live="polite">
              {isEmptyTab ? "No cameras in this tab" : `${visible.length} of ${sourceCameras.length} cameras`}
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {!showTabs && (
                <Button icon={faPlus} onClick={addTab}>
                  New view
                </Button>
              )}
              <Button
                variant={showRecent ? "secondary" : "ghost"}
                size="sm"
                icon={faListUl}
                aria-pressed={showRecent}
                onClick={() => setShowRecent((v) => !v)}
              >
                Recent detections
              </Button>
              <Toggle compact label="Detection overlay" checked={showOverlay} onChange={setShowOverlay} />
            </div>
          </div>
        </Card>

        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {showTabs && <WorkspaceTabs tabs={barTabs} activeId={activeId} maxTabs={MAX_TABS} onSelect={selectTab} onClose={closeTab} onAdd={addTab} />}
            <div
              role={showTabs ? "tabpanel" : undefined}
              id={showTabs ? `panel-${activeId}` : undefined}
              aria-labelledby={showTabs ? `tab-${activeId}` : undefined}
              className="min-h-0 flex-1 p-3"
            >
              {activeTab && isEmptyTab ? (
                <EmptyTabPicker key={activeTab.id} cameras={cameras} limit={effectivePerScreen} onAssign={assignCameras} />
              ) : visible.length === 0 ? (
                <div className="h-full overflow-y-auto">
                  <EmptyState
                    icon={faVideoSlash}
                    title="No cameras match"
                    description="Nothing in this view matches the current filter."
                    action={
                      <Button icon={faXmark} onClick={clearFilters}>
                        Clear filters
                      </Button>
                    }
                  />
                </div>
              ) : (
                <CameraGrid
                  cameras={visible}
                  detectionsByCamera={detectionsByCamera}
                  size={fitGridSize(visible.length)}
                  showOverlay={showOverlay}
                  active={fullscreen === undefined}
                  onFullscreen={setFullscreenId}
                />
              )}
            </div>
          </Card>

          {showRecent && (
            <Card className="flex max-h-60 shrink-0 flex-col overflow-hidden lg:max-h-none lg:w-80">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-sm font-semibold">Recent detections</h2>
                <Link href="/detections" className="text-xs font-medium text-accent hover:underline">
                  View all
                </Link>
              </div>
              {recentForVisible.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted">
                  Waiting for detections on the visible cameras.
                </p>
              ) : (
                <ul className="divide-y divide-line overflow-y-auto">
                  {recentForVisible.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                      <VehicleThumbnail type={d.vehicleType} eventId={d.id} hasImage={d.hasVehicleImage} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          {d.hasPlate && d.plate ? (
                            <PlateTag plate={d.plate} />
                          ) : (
                            <span className="text-xs text-muted">No plate</span>
                          )}
                          <span className="text-[11px] tabular-nums text-muted">
                            {formatTimeWithSeconds(d.detectedAt)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted">
                          {VEHICLE_TYPE_LABELS[d.vehicleType]} · {d.cameraName}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>

      {fullscreen && (
        <FullscreenCameraModal
          camera={fullscreen}
          detections={detectionsByCamera.get(fullscreen.id) ?? []}
          showOverlay={showOverlay}
          onClose={closeFullscreen}
        />
      )}
    </>
  );
}
