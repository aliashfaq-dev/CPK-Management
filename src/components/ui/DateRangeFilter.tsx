import type { DateRangeKey } from "@/types";
import { cn } from "@/lib/utils";
import { Input } from "./Input";

const OPTIONS: Array<{ value: DateRangeKey; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];

interface DateRangeFilterProps {
  value: DateRangeKey;
  onChange: (value: DateRangeKey) => void;
  from: string;
  to: string;
  onCustomChange: (from: string, to: string) => void;
}

export function DateRangeFilter({ value, onChange, from, to, onCustomChange }: DateRangeFilterProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div role="group" aria-label="Date range" className="flex flex-wrap gap-1 rounded-md border border-line bg-surface p-1">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium transition-colors",
              value === option.value ? "bg-accent-soft text-accent" : "text-muted hover:text-fg",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {value === "custom" && (
        <div className="flex flex-wrap items-end gap-2">
          <Input type="date" label="From" value={from} max={to} onChange={(event) => onCustomChange(event.target.value, to)} />
          <Input type="date" label="To" value={to} min={from} onChange={(event) => onCustomChange(from, event.target.value)} />
        </div>
      )}
    </div>
  );
}
