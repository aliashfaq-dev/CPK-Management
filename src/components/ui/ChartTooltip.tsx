interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value?: number | string; name?: string | number }>;
  label?: string | number;
}

export function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs">
      {label !== undefined && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((entry) => (
        <p key={String(entry.name)} className="capitalize text-muted">
          {entry.name}: <span className="font-medium text-fg">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}
