"use client";

import dynamic from "next/dynamic";
import type { AnalyticsData } from "@/types";

const AnalyticsView = dynamic(
  () => import("@/components/analytics/AnalyticsView").then((module) => module.AnalyticsView),
  {
    ssr: false,
    loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-subtle" aria-label="Loading analytics" />,
  },
);

export function DeferredAnalyticsView({ initialData }: { initialData: AnalyticsData }) {
  return <AnalyticsView initialData={initialData} />;
}
