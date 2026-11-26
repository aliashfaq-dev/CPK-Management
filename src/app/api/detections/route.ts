import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth-server";
import { getDetectionsPage } from "@/lib/data-service";
import { parseDetectionQuery, parseUtcDate, type RawParams } from "@/lib/detection-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paginated detections endpoint, plus `?since=<ISO>` catch-up used as a single fallback
 * when SSE has been disconnected for more than 30 seconds.
 */
export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const raw: RawParams = Object.fromEntries(searchParams);
  const parsed = parseDetectionQuery(raw, { pageSize: 50 });
  const since = parseUtcDate(searchParams.get("since") ?? "");
  if (since) {
    parsed.from = since;
  }

  try {
    const result = await getDetectionsPage(parsed);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Could not load detections." }, { status: 500 });
  }
}
