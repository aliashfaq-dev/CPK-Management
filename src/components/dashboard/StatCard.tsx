import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faArrowDown, faArrowUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: IconDefinition;
  change: string;
  trend: "up" | "down";
  comparison: string;
}

export function StatCard({ label, value, icon, change, trend, comparison }: StatCardProps) {
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
        <span className={cn("inline-flex items-center gap-1 font-medium", trend === "up" ? "text-success-strong" : "text-danger-strong")}>
          <FontAwesomeIcon icon={trend === "up" ? faArrowUp : faArrowDown} className="text-[10px]" />
          {change}
        </span>
        <span className="text-muted">{comparison}</span>
      </p>
    </Card>
  );
}
