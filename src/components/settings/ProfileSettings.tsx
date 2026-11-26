"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { User } from "@/types";
import { Badge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SettingsSection } from "./SettingsSection";

const MIN_PASSWORD = 8;

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function ProfileSettings({ user }: { user: User }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  const [nameStatus, setNameStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const onNameSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || savingName) return;
    setSavingName(true);
    setNameStatus(null);
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!response.ok) {
        setNameStatus({ tone: "error", text: await readError(response, "Could not update your name.") });
        return;
      }
      setNameStatus({ tone: "success", text: "Display name updated." });
      router.refresh();
    } finally {
      setSavingName(false);
    }
  };

  const onPasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingPassword) return;
    if (passwords.next.length < MIN_PASSWORD) {
      setPasswordStatus({ tone: "error", text: `Use at least ${MIN_PASSWORD} characters for the new password.` });
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordStatus({ tone: "error", text: "The new passwords do not match." });
      return;
    }
    setSavingPassword(true);
    setPasswordStatus(null);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: passwords.current, next: passwords.next }),
      });
      if (!response.ok) {
        setPasswordStatus({ tone: "error", text: await readError(response, "Could not update your password.") });
        return;
      }
      setPasswords({ current: "", next: "", confirm: "" });
      setPasswordStatus({ tone: "success", text: "Password updated." });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <SettingsSection title="Profile" description="Your signed-in account details and password.">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-base font-semibold text-accent">
          {user.initials}
        </span>
        <div>
          <p className="text-sm font-medium">{user.email}</p>
          <div className="mt-1">
            <Badge tone={user.role === "admin" ? "info" : "neutral"}>{user.role === "admin" ? "Administrator" : "Viewer"}</Badge>
          </div>
        </div>
      </div>

      <form onSubmit={onNameSubmit} className="space-y-4">
        <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <Input type="email" label="Email" value={user.email} disabled hint="Email addresses are managed by an administrator." />
        {nameStatus && (
          <p role="status" className={nameStatus.tone === "success" ? "text-sm text-success-strong" : "text-sm text-danger-strong"}>
            {nameStatus.text}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={savingName || !name.trim() || name.trim() === user.name}>
          {savingName ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <form onSubmit={onPasswordSubmit} className="space-y-4 border-t border-line pt-6">
        <h3 className="text-sm font-semibold">Change password</h3>
        <Input
          type="password"
          label="Current password"
          autoComplete="current-password"
          value={passwords.current}
          onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
        />
        <Input
          type="password"
          label={`New password (at least ${MIN_PASSWORD} characters)`}
          autoComplete="new-password"
          value={passwords.next}
          onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
        />
        <Input
          type="password"
          label="Confirm new password"
          autoComplete="new-password"
          value={passwords.confirm}
          onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
        />
        {passwordStatus && (
          <p role="status" className={passwordStatus.tone === "success" ? "text-sm text-success-strong" : "text-sm text-danger-strong"}>
            {passwordStatus.text}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={!passwords.current || !passwords.next || savingPassword}>
          {savingPassword ? "Updating…" : "Update password"}
        </Button>
      </form>
    </SettingsSection>
  );
}
