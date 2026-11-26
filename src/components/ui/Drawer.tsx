"use client";

import { useId, type ReactNode } from "react";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useEscape } from "@/hooks/useEscape";
import { Button } from "./Button";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const titleId = useId();
  useEscape(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-fg/40" onClick={onClose} aria-hidden="true" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <Button variant="ghost" size="icon" icon={faXmark} aria-label="Close panel" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}
