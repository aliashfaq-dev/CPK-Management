import { NextResponse } from "next/server";
import { invalidateAlertCache } from "@/lib/alerts";
import { authorize } from "@/lib/auth-server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Removes a plate from `public.watchlist` only (never touches detection records). */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request, { admin: true });
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Watchlist entry not found." }, { status: 404 });
  }

  const result = await query("DELETE FROM public.watchlist WHERE id = $1", [id]);
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Watchlist entry not found." }, { status: 404 });
  }
  invalidateAlertCache();
  return NextResponse.json({ ok: true });
}
