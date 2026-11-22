import type { DistributionPoint } from "@/types";
import { BarList } from "@/components/ui/BarList";
import { ChartCard } from "@/components/ui/ChartCard";
import { VEHICLE_TYPE_ICONS } from "@/lib/constants";

export function DetectionOverview({ distribution }: { distribution: DistributionPoint[] }) {
  const total = distribution.reduce((sum, item) => sum + item.value, 0);
  return (
    <ChartCard title="Detection distribution" description="Vehicle types detected today">
      <BarList
        items={distribution.map((item) => ({
          label: item.name === "Bus" ? "Buses" : item.name === "Truck" ? "Trucks" : item.name === "Car" ? "Cars" : "Motorcycles",
          value: item.value,
          icon: VEHICLE_TYPE_ICONS[item.name],
          hint: `${Math.round((item.value / total) * 100)}%`,
        }))}
      />
    </ChartCard>
  );
}
