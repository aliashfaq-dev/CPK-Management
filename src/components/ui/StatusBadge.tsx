import type { ReactNode } from "react";
import type { CameraStatus } from "@/types";
import { cn } from "@/lib/utils";

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-success/10 text-success-strong",
  warning: "bg-warning/10 text-warning-strong",
  danger: "bg-danger/10 text-danger-strong",
  info: "bg-accent-soft text-accent",
  neutral: "bg-subtle text-muted border border-line",
};

export function Badge({ tone = "neutral", dot = false, children }: { tone?: BadgeTone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", toneClasses[tone])}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

const STATUS_MAP: Record<CameraStatus, { label: string; tone: BadgeTone }> = {
  online: { label: "Online", tone: "success" },
  warning: { label: "Warning", tone: "warning" },
  offline: { label: "Offline", tone: "danger" },
};

export function StatusBadge({ status }: { status: CameraStatus }) {
  const { label, tone } = STATUS_MAP[status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}
