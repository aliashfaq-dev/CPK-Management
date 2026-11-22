"use client";

import { useState } from "react";
import { faPen, faPlus } from "@fortawesome/free-solid-svg-icons";
import type { Camera, CameraStatus } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { SettingsSection } from "./SettingsSection";

const RESOLUTIONS = ["1280×720", "1920×1080", "2560×1440"].map((value) => ({ value, label: value }));
const STATUSES: Array<{ value: CameraStatus; label: string }> = [
  { value: "online", label: "Online" },
  { value: "warning", label: "Warning" },
  { value: "offline", label: "Offline" },
];

type Draft = Pick<Camera, "name" | "location" | "resolution" | "status">;
const EMPTY_DRAFT: Draft = { name: "", location: "", resolution: "1920×1080", status: "offline" };

export function CameraSettings({ initialCameras }: { initialCameras: Camera[] }) {
  const [cameras, setCameras] = useLocalStorage<Camera[]>("vts:cameras", initialCameras);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const openNew = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId("new");
  };

  const openEdit = (camera: Camera) => {
    setDraft({ name: camera.name, location: camera.location, resolution: camera.resolution, status: camera.status });
    setEditingId(camera.id);
  };

  const save = () => {
    if (!draft.name.trim() || !draft.location.trim()) return;
    if (editingId === "new") {
      const nextNumber = cameras.reduce((max, c) => Math.max(max, Number(c.id.replace(/\D/g, ""))), 0) + 1;
      setCameras((current) => [
        ...current,
        {
          ...draft,
          id: `CAM-${String(nextNumber).padStart(2, "0")}`,
          lastActivity: new Date().toISOString(),
          fps: 25,
          detectionsToday: 0,
        },
      ]);
    } else {
      setCameras((current) => current.map((c) => (c.id === editingId ? { ...c, ...draft } : c)));
    }
    setEditingId(null);
  };

  return (
    <SettingsSection title="Cameras" description="Add, edit, and review the cameras connected to the system.">
      <div className="flex justify-end">
        <Button variant="primary" icon={faPlus} onClick={openNew}>
          Add camera
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-subtle text-xs text-muted">
              {["Camera", "Location", "Resolution", "Status", ""].map((label, index) => (
                <th key={index} scope="col" className="px-4 py-3 font-medium">
                  {label || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {cameras.map((camera) => (
              <tr key={camera.id}>
                <td className="px-4 py-3">
                  <span className="font-medium">{camera.name}</span> <span className="text-xs text-muted">{camera.id}</span>
                </td>
                <td className="px-4 py-3 text-muted">{camera.location}</td>
                <td className="px-4 py-3 text-muted">{camera.resolution}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={camera.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" icon={faPen} aria-label={`Edit ${camera.name}`} onClick={() => openEdit(camera)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title={editingId === "new" ? "Add camera" : "Edit camera"}
        footer={
          <>
            <Button onClick={() => setEditingId(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={!draft.name.trim() || !draft.location.trim()}>
              Save camera
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Camera name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input label="Location" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
          <Select label="Resolution" value={draft.resolution} onChange={(e) => setDraft({ ...draft, resolution: e.target.value })} options={RESOLUTIONS} />
          <Select label="Status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as CameraStatus })} options={STATUSES} />
        </div>
      </Modal>
    </SettingsSection>
  );
}
