"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import type { User } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SettingsSection } from "./SettingsSection";
import type { SectionProps } from "./GeneralSettings";

export function ProfileSettings({ settings, update, user }: SectionProps & { user: User }) {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (avatar) URL.revokeObjectURL(avatar);
    setAvatar(file ? URL.createObjectURL(file) : null);
  };

  const onPasswordSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (passwords.next.length < 8) {
      setMessage({ tone: "error", text: "Use at least 8 characters for the new password." });
    } else if (passwords.next !== passwords.confirm) {
      setMessage({ tone: "error", text: "The new passwords do not match." });
    } else {
      // UI only: connect this to your authentication API.
      setPasswords({ current: "", next: "", confirm: "" });
      setMessage({ tone: "success", text: "Password form is valid. Connect an authentication API to save it." });
    }
  };

  return (
    <SettingsSection title="Profile" description="Your name, email, photo, and password.">
      <div className="flex items-center gap-4">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="Profile preview" className="h-16 w-16 rounded-full border border-line object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">{user.initials}</span>
        )}
        <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-line bg-surface px-3.5 text-sm font-medium hover:bg-subtle focus-within:outline-2 focus-within:outline-accent">
          Change photo
          <input type="file" accept="image/*" className="sr-only" onChange={onAvatarChange} />
        </label>
      </div>

      <Input label="Name" value={settings.profileName} onChange={(e) => update({ profileName: e.target.value })} />
      <Input type="email" label="Email" value={settings.profileEmail} onChange={(e) => update({ profileEmail: e.target.value })} />

      <form onSubmit={onPasswordSubmit} className="space-y-4 border-t border-line pt-6">
        <h3 className="text-sm font-semibold">Change password</h3>
        <Input type="password" label="Current password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} />
        <Input type="password" label="New password" autoComplete="new-password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} />
        <Input type="password" label="Confirm new password" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
        {message && (
          <p role="status" className={message.tone === "success" ? "text-sm text-success-strong" : "text-sm text-danger-strong"}>
            {message.text}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={!passwords.current}>
          Update password
        </Button>
      </form>
    </SettingsSection>
  );
}
