"use client";

import Link from "next/link";
import { useState } from "react";
import type { Detection } from "@/types";
import { DetectionDetailDrawer } from "@/components/detections/DetectionDetailDrawer";
import { DetectionTable } from "@/components/detections/DetectionTable";
import { ChartCard } from "@/components/ui/ChartCard";

export function RecentDetections({ detections }: { detections: Detection[] }) {
  const [selected, setSelected] = useState<Detection | null>(null);

  return (
    <>
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
        <DetectionTable detections={detections} variant="compact" onSelect={setSelected} />
      </ChartCard>
      <DetectionDetailDrawer detection={selected} onClose={() => setSelected(null)} />
    </>
  );
}
