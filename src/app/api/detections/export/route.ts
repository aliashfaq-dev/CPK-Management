import { iterateDetections } from "@/lib/data-service";
import { parseFilters, type RawParams } from "@/lib/detection-query";
import { VEHICLE_TYPE_LABELS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADER = ["Event ID", "Detected at (UTC)", "Camera ID", "Camera", "Location", "License plate", "Plate confidence (%)", "Vehicle type", "Make and model", "Colour"];

function cell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Streams every detection matching the filters as CSV, one database batch at a time. */
export async function GET(request: Request) {
  const params: RawParams = Object.fromEntries(new URL(request.url).searchParams);
  const filters = parseFilters(params);
  const encoder = new TextEncoder();
  const batches = iterateDetections(filters, 1000);
  let first = true;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (first) {
          first = false;
          controller.enqueue(encoder.encode(`\uFEFF${HEADER.map(cell).join(",")}\r\n`));
          return;
        }
        const next = await batches.next();
        if (next.done) {
          controller.close();
          return;
        }
        const lines = next.value.map((d) =>
          [d.id, d.detectedAt, d.cameraId, d.cameraName, d.location, d.plate, d.hasPlate ? d.confidence.toFixed(1) : "", VEHICLE_TYPE_LABELS[d.vehicleType] ?? d.vehicleType, d.make, d.color]
            .map(cell)
            .join(","),
        );
        controller.enqueue(encoder.encode(`${lines.join("\r\n")}\r\n`));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await batches.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="detections.csv"',
      "Cache-Control": "no-store",
    },
  });
}
