import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  icon?: IconDefinition;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}

export function Tabs({ items, value, onChange, label = "Sections" }: TabsProps) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line px-3">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={active}
            aria-controls={`panel-${item.id}`}
            onClick={() => onChange(item.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
              active ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {item.icon && <FontAwesomeIcon icon={item.icon} className="text-xs" />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
