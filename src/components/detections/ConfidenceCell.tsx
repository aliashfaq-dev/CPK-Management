import { cn } from "@/lib/utils";

export function ConfidenceCell({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        value >= 95 ? "text-success-strong" : value >= 90 ? "text-fg" : "text-warning-strong",
      )}
    >
      {value.toFixed(1)}%
    </span>
  );
}
