import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { presignEventObjectUrl } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EventImageRow {
  vehicle_key: string | null;
  plate_key: string | null;
  s3_bucket: string | null;
}

/**
 * Redirects (302) to a short-lived presigned S3 GET URL for `vehicle` or `plate`.
 * Object keys, bucket names, and storage endpoints are never embedded in page HTML.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ eventId: string; kind: string }> },
) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  const { eventId, kind } = await context.params;
  if ((kind !== "vehicle" && kind !== "plate") || !eventId || eventId.length > 128) {
    return new NextResponse(null, { status: 404 });
  }

  const result = await query<EventImageRow>(
    "SELECT vehicle_key, plate_key, s3_bucket FROM public.v_events_dashboard WHERE event_id = $1 LIMIT 1",
    [eventId],
  );
  const row = result.rows[0];
  const rawKey = kind === "vehicle" ? row?.vehicle_key : row?.plate_key;
  const key = rawKey?.trim();
  if (!row || !key) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const signedUrl = await presignEventObjectUrl(row.s3_bucket, key);
    return NextResponse.redirect(signedUrl, {
      status: 302,
      headers: {
        // Keep inside the 5-minute presign lifetime; private so shared proxies never cache it.
        "Cache-Control": "private, max-age=240",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image storage is unavailable." }, { status: 503 });
  }
}
