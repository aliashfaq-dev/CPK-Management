"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { faFlag, faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import type { WatchlistEntry } from "@/types";
import { PlateTag } from "@/components/detections/PlateTag";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/LoadingState";
import { formatDateTime } from "@/lib/utils";
import { SettingsSection } from "./SettingsSection";

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Admin watchlist editor. Adding or removing plates here affects realtime alert matching only;
 * recorded detection events are never modified or deleted.
 */
export function WatchlistSettings() {
  const [entries, setEntries] = useState<WatchlistEntry[] | null>(null);
  const [plate, setPlate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/watchlist", { cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response, "Could not load watchlist."));
      const body = (await response.json()) as { entries: WatchlistEntry[] };
      setEntries(body.entries);
      setError(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load watchlist.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!plate.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: plate.trim(), note: note.trim() || undefined }),
      });
      if (!response.ok) {
        setError(await readError(response, "Could not add plate to watchlist."));
        return;
      }
      setPlate("");
      setNote("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (id: string) => {
    setError(null);
    const response = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await readError(response, "Could not remove watchlist entry."));
      return;
    }
    await load();
  };

  return (
    <SettingsSection
      title="Watchlist"
      description="Plates listed here raise an immediate high-severity alert whenever a camera reads a match. Removing an entry only stops future alerts; historical detections are kept."
    >
      <form onSubmit={onAdd} className="grid gap-3 rounded-lg border border-line bg-subtle p-4 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <Input
            label="License plate"
            placeholder="e.g. BKL-2847"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Input
            label="Reason / note (optional)"
            placeholder="e.g. Stolen report #412"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="danger" icon={faPlus} disabled={!plate.trim() || busy} className="w-full">
            Add plate
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-strong">
          {error}
        </p>
      )}

      {entries === null ? (
        <LoadingState label="Loading watchlist…" />
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-line">
          <EmptyState
            icon={faFlag}
            title="Watchlist is empty"
            description="Add a license plate above to trigger high-priority alerts when it is spotted."
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle text-xs text-muted">
                <th scope="col" className="px-4 py-3 font-medium">Plate (normalised)</th>
                <th scope="col" className="px-4 py-3 font-medium">Note</th>
                <th scope="col" className="px-4 py-3 font-medium">Added</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3">
                    <PlateTag plate={entry.plateNorm} />
                  </td>
                  <td className="px-4 py-3 text-muted">{entry.note ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(entry.createdAt)} UTC</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={faXmark}
                      aria-label={`Remove ${entry.plateNorm} from watchlist`}
                      onClick={() => void onRemove(entry.id)}
                    >
                      Remove
                    </Button>
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
