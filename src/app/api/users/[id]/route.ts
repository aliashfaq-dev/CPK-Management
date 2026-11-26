import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, clearUserCache } from "@/lib/auth-server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ isActive: z.boolean() });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Enable or disable an account. Users are never hard-deleted. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize(request, { admin: true });
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown user." }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  if (!parsed.data.isActive) {
    if (id === auth.user.id) return NextResponse.json({ error: "You cannot disable your own account." }, { status: 400 });
    const [admins, target] = await Promise.all([
      query<{ total: string }>("SELECT COUNT(*) AS total FROM public.app_users WHERE role = 'admin' AND is_active AND id <> $1", [id]),
      query<{ role: string }>("SELECT role FROM public.app_users WHERE id = $1", [id]),
    ]);
    if (target.rows[0]?.role === "admin" && Number(admins.rows[0]?.total ?? 0) === 0) {
      return NextResponse.json({ error: "At least one active administrator is required." }, { status: 400 });
    }
  }

  const result = await query("UPDATE public.app_users SET is_active = $1 WHERE id = $2", [parsed.data.isActive, id]);
  if (result.rowCount === 0) return NextResponse.json({ error: "Unknown user." }, { status: 404 });
  clearUserCache();
  return NextResponse.json({ ok: true });
}
