import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, clearUserCache, initialsOf, passwordFingerprint } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().trim().min(1).max(100) });

/** Updates the signed-in user's own display name. */
export async function PATCH(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a display name between 1 and 100 characters." }, { status: 400 });
  }

  const result = await query<{ password_hash: string }>(
    "UPDATE public.app_users SET name = $1 WHERE id = $2 RETURNING password_hash",
    [parsed.data.name, auth.user.id],
  );
  const row = result.rows[0];
  if (!row) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  clearUserCache();
  const updated = { ...auth.user, name: parsed.data.name, initials: initialsOf(parsed.data.name) };
  const token = await signSession({
    sub: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    fp: passwordFingerprint(row.password_hash),
  });
  const response = NextResponse.json({ user: updated });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
