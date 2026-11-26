import { NextResponse } from "next/server";
import { getAnalytics, trailingWindow } from "@/lib/data-service";
import { parseUtcDate } from "@/lib/detection-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `?days=7` (trailing window) or `?from=YYYY-MM-DD&to=YYYY-MM-DD` (inclusive, max 90 days). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = parseUtcDate(params.get("from") ?? "");
  const to = parseUtcDate(params.get("to") ?? "", true);
  const days = Number(params.get("days"));
  const range = from && to && Date.parse(to) > Date.parse(from) ? { from, to } : trailingWindow(Number.isFinite(days) && days > 0 ? days : 7);
  try {
    return NextResponse.json(await getAnalytics(range));
  } catch {
    return NextResponse.json({ error: "Could not load analytics." }, { status: 500 });
  }
}
