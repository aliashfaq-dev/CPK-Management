import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatNumber } from "@/lib/utils";

export interface BarListItem {
  label: string;
  value: number;
  icon?: IconDefinition;
  hint?: string;
}

export function BarList({ items }: { items: BarListItem[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              {item.icon && <FontAwesomeIcon icon={item.icon} className="w-4 text-muted" />}
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted">
              <span className="font-medium text-fg">{formatNumber(item.value)}</span>
              {item.hint && ` · ${item.hint}`}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-subtle" role="presentation">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
