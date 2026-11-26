"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { faUserPlus } from "@fortawesome/free-solid-svg-icons";
import { Badge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/LoadingState";
import { Modal } from "@/components/ui/Modal";
import { formatDateTime } from "@/lib/utils";
import { SettingsSection } from "./SettingsSection";

interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "viewer";
  isActive: boolean;
  createdAt: string;
}

const MIN_PASSWORD = 8;
const EMPTY = { name: "", email: "", password: "" };

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Admin-only: list users, add viewers, disable or re-enable accounts. Accounts are never deleted. */
export function UsersSettings({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response, "Could not load users."));
      setUsers(((await response.json()) as { users: ManagedUser[] }).users);
      setError(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load users.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const closeModal = () => {
    setAdding(false);
    setDraft(EMPTY);
    setFormError(null);
  };

  const onAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        setFormError(await readError(response, "Could not add the user."));
        return;
      }
      closeModal();
      await load();
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (user: ManagedUser, isActive: boolean) => {
    setError(null);
    const response = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (!response.ok) setError(await readError(response, "Could not update the user."));
    await load();
  };

  const canSave = draft.name.trim() !== "" && draft.email.includes("@") && draft.password.length >= MIN_PASSWORD && !busy;

  return (
    <SettingsSection title="Users" description="Viewers can look at data but cannot change anything. Accounts can be disabled, never deleted.">
      <div className="flex justify-end">
        <Button variant="primary" icon={faUserPlus} onClick={() => setAdding(true)}>
          Add viewer
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-strong">
          {error}
        </p>
      )}

      {users === null ? (
        <LoadingState label="Loading users…" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle text-xs text-muted">
                {["Name", "Role", "Status", "Created", ""].map((label, index) => (
                  <th key={index} scope="col" className="px-4 py-3 font-medium">
                    {label || <span className="sr-only">Actions</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <span className="block font-medium">{user.name}</span>
                    <span className="block text-xs text-muted">{user.email}</span>
                  </td>
                  <td className="px-4 py-3 capitalize">{user.role}</td>
                  <td className="px-4 py-3">
                    <Badge tone={user.isActive ? "success" : "neutral"} dot>
                      {user.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDateTime(user.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {user.id === currentUserId ? (
                      <span className="text-xs text-muted">You</span>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => void setActive(user, !user.isActive)} aria-label={`${user.isActive ? "Disable" : "Enable"} ${user.name}`}>
                        {user.isActive ? "Disable" : "Enable"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={adding}
        onClose={closeModal}
        title="Add viewer"
        footer={
          <>
            <Button onClick={closeModal}>Cancel</Button>
            <Button variant="primary" type="submit" form="add-viewer-form" disabled={!canSave}>
              Add viewer
            </Button>
          </>
        }
      >
        <form id="add-viewer-form" onSubmit={onAdd} className="space-y-4">
          <Input label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoComplete="off" />
          <Input type="email" label="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} autoComplete="off" />
          <Input type="password" label={`Temporary password (at least ${MIN_PASSWORD} characters)`} value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} autoComplete="new-password" />
          {formError && (
            <p role="alert" className="text-sm text-danger-strong">
              {formError}
            </p>
          )}
        </form>
      </Modal>
    </SettingsSection>
  );
}
