"use client";

import { useMemo, useState } from "react";
import { faVideo } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Camera } from "@/types";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { sortByCameraNumber } from "@/lib/cameras";

interface EmptyTabPickerProps {
  cameras: Camera[];
  /** Most cameras this tab can hold (the "Show" dropdown). */
  limit: number;
  onAssign: (cameraIds: string[]) => void;
}

/** Blank-tab state: select registered cameras from the list to load into this view. */
export function EmptyTabPicker({ cameras, limit, onAssign }: EmptyTabPickerProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const sorted = useMemo(() => sortByCameraNumber(cameras), [cameras]);
  const full = selected.length >= limit;

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length >= limit
          ? current
          : [...current, id],
    );

  return (
    <div className="flex h-full min-h-0 flex-col items-center overflow-y-auto py-4">
      <div className="my-auto w-full max-w-xl">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-accent-soft text-accent">
            <FontAwesomeIcon icon={faVideo} />
          </span>
          <h2 className="mt-3 text-base font-semibold">New camera view</h2>
          <p className="mt-1 text-sm text-muted">Choose the cameras to display in this tab.</p>
        </div>

        <ul className="mt-4 max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line" aria-label="Registered cameras">
          {sorted.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted">No cameras registered yet.</li>
          ) : (
            sorted.map((camera) => {
              const checked = selected.includes(camera.id);
              return (
                <li key={camera.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-subtle has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && full}
                      onChange={() => toggle(camera.id)}
                      className="h-4 w-4 accent-accent"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {camera.id} · {camera.name}
                      </span>
                      <span className="block truncate text-xs text-muted">{camera.location}</span>
                    </span>
                    <StatusBadge status={camera.status} />
                  </label>
                </li>
              );
            })
          )}
        </ul>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted" aria-live="polite">
            {selected.length} of {limit} selected{full && limit < 9 ? ". Raise “Show” to add more." : ""}
          </p>
          <Button variant="primary" disabled={selected.length === 0} onClick={() => onAssign(selected)}>
            Load {selected.length > 0 ? selected.length : ""} {selected.length === 1 ? "camera" : "cameras"}
          </Button>
        </div>
      </div>
    </div>
  );
}
