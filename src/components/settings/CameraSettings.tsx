"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  faPlay,
  faPlus,
  faRotateRight,
  faStop,
  faTrashCan,
  faVideoSlash,
} from "@fortawesome/free-solid-svg-icons";
import type { Camera, PipelineStream, PlateFormat } from "@/types";
import { Badge, StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/LoadingState";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { formatDateTime } from "@/lib/utils";
import { SettingsSection } from "./SettingsSection";

const PLATE_FORMATS: Array<{ value: PlateFormat; label: string }> = [
  { value: "PAKISTAN", label: "Pakistan" },
  { value: "GENERAL", label: "General" },
  { value: "UK", label: "UK" },
];

interface NewStreamDraft {
  id: string;
  name: string;
  camera_id: string;
  location: string;
  sourceType: "file" | "rtsp";
  file: string;
  url: string;
  loop: boolean;
  plate_format: PlateFormat;
}

const EMPTY_DRAFT: NewStreamDraft = {
  id: "",
  name: "",
  camera_id: "",
  location: "",
  sourceType: "file",
  file: "",
  url: "",
  loop: true,
  plate_format: "PAKISTAN",
};

function slugifyId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function formatUptime(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${seconds % 60}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function CameraSettings({
  initialCameras,
  isAdmin = false,
}: {
  initialCameras: Camera[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [streams, setStreams] = useState<PipelineStream[] | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyStreamId, setBusyStreamId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [videos, setVideos] = useState<string[]>([]);
  const [draft, setDraft] = useState<NewStreamDraft>(EMPTY_DRAFT);
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<PipelineStream | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadStreams = useCallback(async () => {
    try {
      const response = await fetch("/api/pipeline/streams", { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as {
        streams?: PipelineStream[];
        error?: string;
      };
      if (!response.ok) {
        setStreams([]);
        setPipelineError(body.error ?? "Detection pipeline is unreachable.");
        return;
      }
      setStreams(body.streams ?? []);
      setPipelineError(null);
    } catch {
      setStreams([]);
      setPipelineError("Detection pipeline is unreachable.");
    }
  }, []);

  useEffect(() => {
    void loadStreams();
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        void loadStreams();
      }
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [loadStreams]);

  const openCreateModal = async () => {
    setDraft(EMPTY_DRAFT);
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/pipeline/videos", { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { videos?: string[] };
      const list = body.videos ?? [];
      setVideos(list);
      if (list.length > 0) {
        setDraft((current) => ({ ...current, file: current.file || list[0] }));
      }
    } catch {
      setVideos([]);
    }
  };

  const runAction = async (streamId: string, action: "start" | "stop" | "restart") => {
    setBusyStreamId(streamId);
    setActionError(null);
    try {
      const response = await fetch(`/api/pipeline/streams/${encodeURIComponent(streamId)}/${action}`, {
        method: "POST",
      });
      if (!response.ok) {
        setActionError(await readError(response, `Could not ${action} stream.`));
      }
      await loadStreams();
    } finally {
      setBusyStreamId(null);
    }
  };

  const onCreateSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const derivedId = slugifyId(draft.id || draft.camera_id || draft.name);
    if (!derivedId) {
      setCreateError("Enter a valid stream ID or camera ID.");
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      const payload = {
        id: derivedId,
        name: draft.name.trim(),
        camera_id: draft.camera_id.trim(),
        location: draft.location.trim(),
        loop: draft.sourceType === "file" ? draft.loop : false,
        plate_format: draft.plate_format,
        source:
          draft.sourceType === "file"
            ? { type: "file" as const, file: draft.file.trim() }
            : { type: "rtsp" as const, url: draft.url.trim() },
      };
      const response = await fetch("/api/pipeline/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setCreateError(await readError(response, "Could not create stream."));
        return;
      }
      setCreating(false);
      await loadStreams();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const onDeleteConfirm = async () => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/pipeline/streams/${encodeURIComponent(confirmDelete.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setActionError(await readError(response, "Could not delete stream."));
      } else {
        setConfirmDelete(null);
      }
      await loadStreams();
    } finally {
      setDeleting(false);
    }
  };

  const canSubmitNew =
    draft.name.trim() !== "" &&
    draft.camera_id.trim() !== "" &&
    draft.location.trim() !== "" &&
    (draft.sourceType === "file" ? draft.file.trim() !== "" : draft.url.trim().toLowerCase().startsWith("rtsp://")) &&
    !submitting;

  return (
    <div className="space-y-8">
      <SettingsSection
        title="Pipeline streams"
        description="Manage live detection streams on the local inference service. A started stream keeps running in the background until explicitly stopped."
      >
        {isAdmin && (
          <div className="flex justify-end">
            <Button variant="primary" icon={faPlus} onClick={() => void openCreateModal()}>
              New stream
            </Button>
          </div>
        )}

        {pipelineError && (
          <p role="status" className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning-strong">
            {pipelineError}
          </p>
        )}

        {actionError && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-strong">
            {actionError}
          </p>
        )}

        {streams === null ? (
          <LoadingState label="Loading pipeline streams…" />
        ) : streams.length === 0 ? (
          <div className="rounded-lg border border-line">
            <EmptyState
              icon={faVideoSlash}
              title="No active pipeline streams"
              description={
                isAdmin
                  ? "Create a stream from a video in public/videos or an RTSP camera URL."
                  : "No streams are registered on the pipeline right now."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle text-xs text-muted">
                  <th scope="col" className="px-4 py-3 font-medium">Stream</th>
                  <th scope="col" className="px-4 py-3 font-medium">Camera</th>
                  <th scope="col" className="px-4 py-3 font-medium">Source</th>
                  <th scope="col" className="px-4 py-3 font-medium">State</th>
                  <th scope="col" className="px-4 py-3 font-medium">Telemetry</th>
                  {isAdmin && <th scope="col" className="px-4 py-3 text-right font-medium">Controls</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {streams.map((stream) => {
                  const state = stream.status?.state ?? "stopped";
                  const busy = busyStreamId === stream.id;
                  return (
                    <tr key={stream.id}>
                      <td className="px-4 py-3">
                        <span className="block font-medium">{stream.name}</span>
                        <span className="block font-mono text-xs text-muted">{stream.id} · {stream.plate_format}</span>
                      </td>
                      <td className="px-4 py-3 text-muted">{stream.camera_id}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        <span className="block max-w-52 truncate font-mono">
                          {stream.source.type === "file" ? stream.source.file : stream.source.url}
                        </span>
                        {stream.source.type === "file" && stream.loop && <span>Looping enabled</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={state === "running" ? "success" : state === "error" ? "danger" : "neutral"}
                          dot
                        >
                          {state}
                        </Badge>
                        {stream.status?.last_error && (
                          <p className="mt-1 max-w-48 truncate text-xs text-danger-strong" title={stream.status.last_error}>
                            {stream.status.last_error}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-muted">
                        {stream.status ? (
                          <>
                            <span className="block">{stream.status.fps.toFixed(1)} fps · {stream.status.events} events</span>
                            <span className="block">Uptime {formatUptime(stream.status.uptime_s)} · {stream.status.restarts} restarts</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      {isAdmin && (
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={faPlay}
                              disabled={busy || state === "running"}
                              aria-label={`Start ${stream.name}`}
                              onClick={() => void runAction(stream.id, "start")}
                            >
                              Start
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={faStop}
                              disabled={busy || state === "stopped"}
                              aria-label={`Stop ${stream.name}`}
                              onClick={() => void runAction(stream.id, "stop")}
                            >
                              Stop
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={faRotateRight}
                              disabled={busy}
                              aria-label={`Restart ${stream.name}`}
                              onClick={() => void runAction(stream.id, "restart")}
                            >
                              Restart
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={faTrashCan}
                              disabled={busy}
                              aria-label={`Delete ${stream.name}`}
                              onClick={() => setConfirmDelete(stream)}
                            />
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Registered cameras" description="Camera records stored in PostgreSQL.">
        {initialCameras.length === 0 ? (
          <div className="rounded-lg border border-line">
            <EmptyState icon={faVideoSlash} title="No cameras registered" description="Creating a stream automatically registers its camera here." />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-subtle text-xs text-muted">
                  <th scope="col" className="px-4 py-3 font-medium">Camera</th>
                  <th scope="col" className="px-4 py-3 font-medium">Location</th>
                  <th scope="col" className="px-4 py-3 font-medium">Last activity</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {initialCameras.map((camera) => (
                  <tr key={camera.id}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{camera.name}</span>{" "}
                      <span className="text-xs text-muted">{camera.id}</span>
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

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New stream"
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="new-stream-form" disabled={!canSubmitNew}>
              {submitting ? "Creating…" : "Create stream"}
            </Button>
          </>
        }
      >
        <form id="new-stream-form" onSubmit={onCreateSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Stream name"
              placeholder="e.g. Karsaz Northbound"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <Input
              label="Camera ID"
              placeholder="e.g. CAM-01"
              value={draft.camera_id}
              onChange={(e) => setDraft({ ...draft, camera_id: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Location"
              placeholder="e.g. Shahrah-e-Faisal, Karsaz"
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            />
            <Input
              label="Stream ID (optional)"
              placeholder={slugifyId(draft.camera_id || draft.name) || "cam-01"}
              value={draft.id}
              onChange={(e) => setDraft({ ...draft, id: slugifyId(e.target.value) })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Source type"
              value={draft.sourceType}
              onChange={(e) => setDraft({ ...draft, sourceType: e.target.value as "file" | "rtsp" })}
              options={[
                { value: "file", label: "Video file (public/videos)" },
                { value: "rtsp", label: "RTSP camera stream" },
              ]}
            />
            <Select
              label="Plate format"
              value={draft.plate_format}
              onChange={(e) => setDraft({ ...draft, plate_format: e.target.value as PlateFormat })}
              options={PLATE_FORMATS}
            />
          </div>

          {draft.sourceType === "file" ? (
            videos.length > 0 ? (
              <Select
                label="Video file"
                value={draft.file}
                onChange={(e) => setDraft({ ...draft, file: e.target.value })}
                options={videos.map((v) => ({ value: v, label: v }))}
              />
            ) : (
              <Input
                label="Video filename (in VIDEO_DIR / public/videos)"
                placeholder="e.g. sample.mp4"
                value={draft.file}
                onChange={(e) => setDraft({ ...draft, file: e.target.value })}
                hint="Drop .mp4, .mkv, or .avi files into public/videos so they appear in the dropdown."
              />
            )
          ) : (
            <Input
              label="RTSP URL"
              placeholder="rtsp://127.0.0.1:8554/camera1"
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            />
          )}

          {draft.sourceType === "file" && (
            <Toggle
              label="Loop video continuously"
              description="Restart from the beginning when the file reaches the end."
              checked={draft.loop}
              onChange={(loop) => setDraft({ ...draft, loop })}
            />
          )}

          {createError && (
            <p role="alert" className="text-sm text-danger-strong">
              {createError}
            </p>
          )}
        </form>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete stream"
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => void onDeleteConfirm()} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete stream"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Stop and remove stream <strong className="text-fg">{confirmDelete?.name}</strong> ({confirmDelete?.id}) from the pipeline? Camera metadata and recorded detections in PostgreSQL are not deleted.
        </p>
      </Modal>
    </div>
  );
}
