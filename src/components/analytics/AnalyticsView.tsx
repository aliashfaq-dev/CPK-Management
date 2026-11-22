"use client";

import { useEffect, useState, type ReactElement } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalyticsData, DateRangeKey, VehicleType } from "@/types";
import { BarList } from "@/components/ui/BarList";
import { Card } from "@/components/ui/Card";
import { ChartCard } from "@/components/ui/ChartCard";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import { LoadingState } from "@/components/ui/LoadingState";
import { CHART_COLORS, VEHICLE_TYPE_COLORS, VEHICLE_TYPE_ICONS } from "@/lib/constants";
import { getAnalytics } from "@/lib/data-service";
import { formatNumber } from "@/lib/utils";

const RANGE_DAYS: Record<Exclude<DateRangeKey, "custom">, number> = { today: 1, "7d": 7, "30d": 30 };
const tick = { fill: CHART_COLORS.axis, fontSize: 12 };
const margin = { top: 4, right: 8, bottom: 0, left: -16 };

function daysBetween(from: string, to: string): number {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  return Number.isFinite(days) ? Math.min(90, Math.max(1, days)) : 1;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </Card>
  );
}

function ChartBox({ children }: { children: ReactElement }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function AnalyticsView() {
  const [range, setRange] = useState<DateRangeKey>("7d");
  const [from, setFrom] = useState("2026-11-10");
  const [to, setTo] = useState("2026-11-22");
  const [result, setResult] = useState<{ days: number; data: AnalyticsData } | null>(null);

  const days = range === "custom" ? daysBetween(from, to) : RANGE_DAYS[range];

  useEffect(() => {
    let cancelled = false;
    getAnalytics(days).then((data) => {
      if (!cancelled) setResult({ days, data });
    });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const data = result?.days === days ? result.data : null;

  const filter = (
    <div className="mb-6">
      <DateRangeFilter value={range} onChange={setRange} from={from} to={to} onCustomChange={(f, t) => { setFrom(f); setTo(t); }} />
    </div>
  );

  if (!data) {
    return (
      <>
        {filter}
        <LoadingState label="Loading analytics…" />
      </>
    );
  }

  const total = data.trend.reduce((sum, point) => sum + point.detections, 0);
  const peak = data.hourly.reduce((best, point) => (point.detections > best.detections ? point : best));
  const topType = data.distribution.reduce((best, item) => (item.value > best.value ? item : best));
  const avgAccuracy = data.cameraPerformance.reduce((sum, c) => sum + c.accuracy, 0) / data.cameraPerformance.length;
  const distributionTotal = data.distribution.reduce((sum, item) => sum + item.value, 0);
  const activeCameras = [...data.cameraPerformance].sort((a, b) => b.detections - a.detections).slice(0, 5);

  return (
    <>
      {filter}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total detections" value={formatNumber(total)} note={days === 1 ? "Last 24 hours" : `Last ${days} days`} />
        <Metric label="Peak hour" value={peak.label} note={`${peak.detections} detections on average`} />
        <Metric label="Top vehicle type" value={topType.name} note={`${Math.round((topType.value / distributionTotal) * 100)}% of detections`} />
        <Metric label="Average accuracy" value={`${avgAccuracy.toFixed(1)}%`} note="Across all cameras" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Detection trends" description={days === 1 ? "Detections per hour" : "Detections per day"}>
          <ChartBox>
            <LineChart data={data.trend} margin={margin}>
              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tick} interval="preserveStartEnd" minTickGap={28} />
              <YAxis tickLine={false} axisLine={false} tick={tick} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="detections" stroke={CHART_COLORS.accent} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ChartBox>
        </ChartCard>

        <ChartCard title="Vehicle type distribution" description="Share of all detections">
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.distribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={2} stroke={CHART_COLORS.surface}>
                  {data.distribution.map((item) => (
                    <Cell key={item.name} fill={VEHICLE_TYPE_COLORS[item.name as VehicleType]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {data.distribution.map((item) => (
              <li key={item.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: VEHICLE_TYPE_COLORS[item.name] }} aria-hidden="true" />
                <span className="text-muted">{item.name}</span>
                <span className="ml-auto font-medium tabular-nums">{Math.round((item.value / distributionTotal) * 100)}%</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Hourly detection activity" description="Average detections by hour of day">
          <ChartBox>
            <BarChart data={data.hourly} margin={margin}>
              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tick} interval={3} />
              <YAxis tickLine={false} axisLine={false} tick={tick} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART_COLORS.cursor }} />
              <Bar dataKey="detections" fill={CHART_COLORS.accent} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartBox>
        </ChartCard>

        <ChartCard title="Daily and weekly statistics" description="Average detections by day of week">
          <ChartBox>
            <BarChart data={data.weekly} margin={margin}>
              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tick} />
              <YAxis tickLine={false} axisLine={false} tick={tick} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART_COLORS.cursor }} />
              <Bar dataKey="detections" fill={CHART_COLORS.accent} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartBox>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard title="Detection confidence" description="Detections by confidence score">
          <ChartBox>
            <BarChart data={data.confidence} margin={margin}>
              <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis dataKey="range" tickLine={false} axisLine={false} tick={{ ...tick, fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={tick} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART_COLORS.cursor }} />
              <Bar dataKey="count" name="detections" fill={CHART_COLORS.accent} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartBox>
        </ChartCard>

        <ChartCard title="Most active cameras" description="Top five by detections">
          <BarList items={activeCameras.map((c) => ({ label: c.name, value: c.detections }))} />
        </ChartCard>

        <ChartCard title="Top detected vehicle types" description="Ranked by detections">
          <BarList
            items={[...data.distribution]
              .sort((a, b) => b.value - a.value)
              .map((item) => ({ label: item.name, value: item.value, icon: VEHICLE_TYPE_ICONS[item.name], hint: `${Math.round((item.value / distributionTotal) * 100)}%` }))}
          />
        </ChartCard>
      </div>

      <ChartCard className="mt-4" title="Camera performance" description="Detections, uptime, and accuracy per camera" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-subtle text-xs text-muted">
                {["Camera", "Detections", "Uptime", "Accuracy"].map((label) => (
                  <th key={label} scope="col" className="px-5 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.cameraPerformance.map((c) => (
                <tr key={c.cameraId}>
                  <td className="px-5 py-3">
                    <span className="font-medium">{c.name}</span> <span className="text-xs text-muted">{c.cameraId}</span>
                  </td>
                  <td className="px-5 py-3 tabular-nums">{formatNumber(c.detections)}</td>
                  <td className="px-5 py-3 tabular-nums">{c.uptime.toFixed(1)}%</td>
                  <td className="px-5 py-3 tabular-nums">{c.accuracy.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </>
  );
}
