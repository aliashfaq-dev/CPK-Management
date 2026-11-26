import { NextResponse } from "next/server";
import { z } from "zod";
import { MIN_PASSWORD_LENGTH, authorize, clearUserCache, hashPassword, passwordFingerprint, verifyPassword } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { createLimiter } from "@/lib/rate-limit";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ current: z.string().min(1).max(200), next: z.string().min(MIN_PASSWORD_LENGTH).max(200) });
const limiter = createLimiter("password-change", 5, 15 * 60_000);

/** Changes the signed-in user's own password. The old password is required. */
export async function POST(request: Request) {
  const auth = await authorize(request);
  if ("response" in auth) return auth.response;

  const throttle = limiter.hit(auth.user.id);
  if (!throttle.allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(throttle.retryAfterSeconds) } });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: `Use at least ${MIN_PASSWORD_LENGTH} characters for the new password.` }, { status: 400 });

  const result = await query<{ password_hash: string }>("SELECT password_hash FROM public.app_users WHERE id = $1", [auth.user.id]);
  const row = result.rows[0];
  if (!row || !(await verifyPassword(parsed.data.current, row.password_hash))) {
    return NextResponse.json({ error: "The current password is incorrect." }, { status: 400 });
  }

  const hash = await hashPassword(parsed.data.next);
  await query("UPDATE public.app_users SET password_hash = $1 WHERE id = $2", [hash, auth.user.id]);
  clearUserCache();
  limiter.reset(auth.user.id);

  // Sessions are bound to the password fingerprint; re-issue this one so the user stays signed in.
  const token = await signSession({ sub: auth.user.id, email: auth.user.email, name: auth.user.name, role: auth.user.role, fp: passwordFingerprint(hash) });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
