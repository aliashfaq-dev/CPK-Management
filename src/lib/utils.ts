export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export { formatDateTime, formatTime, formatTimeWithSeconds, formatNavbarDateTime } from "@/lib/formatTime";

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/** "White Toyota Corolla", or a plain note while the stage-2 analysis has not run for this record. */
export function vehicleDescription(color: string | null, make: string | null): string {
  const text = [color, make].filter(Boolean).join(" ");
  return text || "Make and colour not analysed yet";
}

export function downloadCsv(filename: string, rows: Array<Array<string | number>>): void {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
