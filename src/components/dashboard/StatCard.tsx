import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faArrowDown, faArrowUp, faMinus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export interface StatChange {
  text: string;
  trend: "up" | "down" | "flat";
}

interface StatCardProps {
  label: string;
  value: string;
  icon: IconDefinition;
  /** Only pass a real comparison; omit it when there is nothing to compare against. */
  change?: StatChange;
  comparison?: string;
  note?: string;
}

export function StatCard({ label, value, icon, change, comparison, note }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft text-accent">
          <FontAwesomeIcon icon={icon} />
        </span>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs">
        {change ? (
          <>
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                change.trend === "up" ? "text-success-strong" : change.trend === "down" ? "text-danger-strong" : "text-muted",
              )}
            >
              <FontAwesomeIcon icon={change.trend === "up" ? faArrowUp : change.trend === "down" ? faArrowDown : faMinus} className="text-[10px]" />
              {change.text}
            </span>
            <span className="text-muted">{comparison}</span>
          </>
        ) : (
          <span className="text-muted">{note ?? "No earlier data to compare"}</span>
        )}
      </p>
    </Card>
  );
}
