"use client";

import dynamic from "next/dynamic";
import type { TimeSeriesPoint } from "@/types";

const ActivityChart = dynamic(
  () => import("@/components/dashboard/ActivityChart").then((module) => module.ActivityChart),
  {
    ssr: false,
    loading: () => <div className="h-[288px] w-full animate-pulse rounded-md bg-subtle" aria-label="Loading activity chart" />,
  },
);

export function DeferredActivityChart({ data }: { data: TimeSeriesPoint[] }) {
  return <ActivityChart data={data} />;
}
