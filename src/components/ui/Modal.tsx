"use client";

import { useId, type ReactNode } from "react";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { useEscape } from "@/hooks/useEscape";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const titleId = useId();
  useEscape(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-fg/40" onClick={onClose} aria-hidden="true" />
      <div className={cn("relative max-h-full w-full max-w-lg overflow-y-auto rounded-lg border border-line bg-surface", className)}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <Button variant="ghost" size="icon" icon={faXmark} aria-label="Close dialog" onClick={onClose} />
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
