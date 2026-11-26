import type { DistributionPoint } from "@/types";
import { BarList } from "@/components/ui/BarList";
import { ChartCard } from "@/components/ui/ChartCard";
import { VEHICLE_TYPE_ICONS, VEHICLE_TYPE_LABELS } from "@/lib/constants";

export function DetectionOverview({ distribution }: { distribution: DistributionPoint[] }) {
  const total = distribution.reduce((sum, item) => sum + item.value, 0);
  return (
    <ChartCard title="Detection distribution" description="Vehicle types detected today">
      <BarList
        items={distribution.map((item) => ({
          label: VEHICLE_TYPE_LABELS[item.name],
          value: item.value,
          icon: VEHICLE_TYPE_ICONS[item.name],
          hint: `${total ? Math.round((item.value / total) * 100) : 0}%`,
        }))}
      />
    </ChartCard>
  );
}
