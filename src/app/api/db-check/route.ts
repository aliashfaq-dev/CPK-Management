import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth-server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Connectivity probe only: returns ok/error, never schema, rows, or connection details. */
export async function GET(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;
  try {
    await query("SELECT 1");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Database connection failed." }, { status: 503 });
  }
}
