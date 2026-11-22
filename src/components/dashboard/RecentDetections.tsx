import Link from "next/link";
import type { Detection } from "@/types";
import { DetectionTable } from "@/components/detections/DetectionTable";
import { ChartCard } from "@/components/ui/ChartCard";

export function RecentDetections({ detections }: { detections: Detection[] }) {
  return (
    <ChartCard
      title="Recent detections"
      description="Latest vehicles recorded across all cameras"
      bodyClassName="p-0"
      action={
        <Link href="/detections" className="text-sm font-medium text-accent hover:underline">
          View all
        </Link>
      }
    >
      <DetectionTable detections={detections} variant="compact" />
    </ChartCard>
  );
}
