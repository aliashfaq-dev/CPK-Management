"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useEscape } from "@/hooks/useEscape";
import { cn } from "@/lib/utils";

interface PopoverProps {
  trigger: ReactNode;
  label: string;
  align?: "left" | "right";
  buttonClassName?: string;
  panelClassName?: string;
  children: (close: () => void) => ReactNode;
}

export function Popover({ trigger, label, align = "right", buttonClassName, panelClassName, children }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  useEscape(open, close);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn("flex h-9 items-center gap-2 rounded-md text-muted transition-colors hover:bg-subtle hover:text-fg", buttonClassName)}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-full z-40 mt-2 rounded-lg border border-line bg-surface",
            align === "right" ? "right-0" : "left-0",
            panelClassName ?? "w-72",
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
