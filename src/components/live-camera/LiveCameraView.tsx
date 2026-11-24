"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { faPlus, faVideoSlash, faXmark } from "@fortawesome/free-solid-svg-icons";
import type { Camera, CameraStatus, Detection, WorkspaceTab } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { useEscape } from "@/hooks/useEscape";
import { matchesCamera, sortByCameraNumber } from "@/lib/cameras";
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

export function LiveCameraView({ cameras, detections }: LiveCameraViewProps) {
  // No tabs on load: the toolbar drives one grid of all cameras. The tab bar appears once "+" opens a custom view.
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeId, setActiveId] = useState(HOME_ID);
  const [perScreen, setPerScreen] = useState<number>(DEFAULT_PER_SCREEN);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showOverlay, setShowOverlay] = useState(true);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const nextTabNumber = useRef(1);

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

  // The home view shows every camera; a custom tab shows only the cameras assigned to it.
  const sourceCameras = useMemo(
    () => (activeTab ? activeTab.cameraIds.flatMap((id) => cameraById.get(id) ?? []) : cameras),
    [activeTab, cameraById, cameras],
  );

  // Toolbar search/status narrow the cameras of the open tab. Anything not in `visible` is unmounted, which stops its feed.
  // Sorted by camera number so "Show: N" always displays CAM-01, CAM-02, ... in order.
  const filtered = useMemo(
    () => sortByCameraNumber(sourceCameras.filter((camera) => (statusFilter === "all" || camera.status === statusFilter) && matchesCamera(camera, query))),
    [sourceCameras, statusFilter, query],
  );

  // Options run 1..N for the cameras in the active tab, capped at the largest grid. An empty tab still offers the cap (it limits the picker).
  const maxPerScreen = isEmptyTab ? MAX_GRID_SIZE : Math.min(Math.max(filtered.length, 1), MAX_GRID_SIZE);
  const perScreenOptions = useMemo(
    () => Array.from({ length: maxPerScreen }, (_, i) => i + 1).map((n) => ({ value: String(n), label: `Show: ${n} ${n === 1 ? "camera" : "cameras"}` })),
    [maxPerScreen],
  );
  // If the selection exceeds what this tab holds (e.g. Show: 6 then a 2-camera tab), clamp it down.
  const effectivePerScreen = Math.min(perScreen, maxPerScreen);
  const visible = useMemo(() => filtered.slice(0, effectivePerScreen), [filtered, effectivePerScreen]);
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
      // Closing the last custom tab drops back to the plain grid and hides the tab bar.
      if (id === activeId) setActiveId(remaining[Math.min(index, remaining.length - 1)]?.id ?? HOME_ID);
    },
    [tabs, activeId],
  );

  const assignCameras = useCallback(
    (ids: string[]) => {
      const first = cameraById.get(ids[0]);
      const title = first ? (ids.length > 1 ? `${first.name} +${ids.length - 1}` : first.name) : "New View";
      // The tab is renamed after the chosen camera/area ("Karsaz Junction", or "Karsaz Junction +2").
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
      {/* Fills the space under the 4rem header and the main padding, so the page itself never scrolls. */}
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
            <div className="ml-auto flex items-center gap-3">
              {!showTabs && (
                <Button icon={faPlus} onClick={addTab}>
                  New view
                </Button>
              )}
              <Toggle compact label="Detection overlay" checked={showOverlay} onChange={setShowOverlay} />
            </div>
          </div>
        </Card>

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
