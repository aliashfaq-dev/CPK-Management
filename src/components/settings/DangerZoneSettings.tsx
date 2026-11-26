"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { SettingsSection } from "./SettingsSection";

interface AuditEntry {
  at: string;
  email: string;
  eventsRemoved: number;
  runsRemoved: number;
  deleteImages: boolean;
  s3ObjectsDeleted: number;
}

export function DangerZoneSettings() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleteImages, setDeleteImages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    eventsRemoved: number;
    runsRemoved: number;
    s3ObjectsDeleted: number;
  } | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/empty-database", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { history?: AuditEntry[] };
      setHistory(body.history ?? []);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (confirmText !== "DELETE" || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/admin/empty-database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE", deleteImages }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        eventsRemoved?: number;
        runsRemoved?: number;
        s3ObjectsDeleted?: number;
      };
      if (!response.ok) {
        setError(body.error ?? "Could not empty the database.");
        return;
      }
      setConfirmText("");
      setResult({
        eventsRemoved: body.eventsRemoved ?? 0,
        runsRemoved: body.runsRemoved ?? 0,
        s3ObjectsDeleted: body.s3ObjectsDeleted ?? 0,
      });
      await loadHistory();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection
      title="Danger zone"
      description="Irreversible administrative operations. Individual detections can never be edited or removed one by one; only a full purge is permitted."
    >
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-danger/40 bg-danger/5 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-danger/15 text-danger-strong">
            <FontAwesomeIcon icon={faTriangleExclamation} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-danger-strong">Empty detection database</h3>
            <p className="mt-1 text-xs text-muted">
              Truncates every row in <code className="font-mono">events</code> and <code className="font-mono">runs</code> inside a single transaction. Registered cameras, user accounts, watchlist entries, and application settings are preserved, and an audit entry is recorded.
            </p>
          </div>
        </div>

        <div className="border-y border-line py-2">
          <Toggle
            label="Also delete event snapshots and run manifests from S3"
            description="Deletes objects under camera prefixes and runs/ in batches of 1,000."
            checked={deleteImages}
            onChange={setDeleteImages}
          />
        </div>

        <Input
          label='Type "DELETE" in uppercase to unlock'
          placeholder="DELETE"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
        />

        {error && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-strong">
            {error}
          </p>
        )}

        {result && (
          <p role="status" className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success-strong">
            Database emptied: {formatNumber(result.eventsRemoved)} detections and {formatNumber(result.runsRemoved)} runs removed
            {deleteImages ? `, plus ${formatNumber(result.s3ObjectsDeleted)} S3 objects deleted` : ""}.
          </p>
        )}

        <Button type="submit" variant="danger" disabled={confirmText !== "DELETE" || busy}>
          {busy ? "Emptying database…" : "Empty database"}
        </Button>
      </form>

      {history.length > 0 && (
        <div className="space-y-2 pt-4">
          <h3 className="text-sm font-semibold">Audit log</h3>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-subtle text-muted">
                  <th scope="col" className="px-4 py-2.5 font-medium">When (UTC)</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Administrator</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Events removed</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Runs removed</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">S3 objects</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.slice(0, 10).map((item, idx) => (
                  <tr key={`${item.at}-${idx}`}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted">{formatDateTime(item.at)}</td>
                    <td className="px-4 py-2.5 font-medium">{item.email}</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatNumber(item.eventsRemoved)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatNumber(item.runsRemoved)}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {item.deleteImages ? formatNumber(item.s3ObjectsDeleted) : "Kept"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
