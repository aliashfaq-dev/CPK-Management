"use client";

import { memo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimeSeriesPoint } from "@/types";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { CHART_COLORS } from "@/lib/constants";

function ActivityChartComponent({ data, height = 288 }: { data: TimeSeriesPoint[]; height?: number }) {
  const tick = { fill: CHART_COLORS.axis, fontSize: 12 };
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tick} interval="preserveStartEnd" minTickGap={28} />
          <YAxis tickLine={false} axisLine={false} tick={tick} />
          <Tooltip content={<ChartTooltip />} />
          <Line type="monotone" dataKey="detections" stroke={CHART_COLORS.accent} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export const ActivityChart = memo(ActivityChartComponent);
