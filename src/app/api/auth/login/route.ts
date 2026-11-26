import { NextResponse } from "next/server";
import { z } from "zod";
import { burnPasswordCheck, ensureBootstrapAdmin, passwordFingerprint, toUser, verifyPassword, type AppUserRow } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { isSameOrigin } from "@/lib/origin";
import { clientIp, createLimiter } from "@/lib/rate-limit";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(200) });

// 5 failures per IP+email and 30 per IP, each per 15 minutes. Successful logins clear the pair counter.
const pairLimiter = createLimiter("login-pair", 5, 15 * 60_000);
const ipLimiter = createLimiter("login-ip", 30, 15 * 60_000);

const GENERIC_ERROR = "Incorrect email or password.";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  const { email, password } = parsed.data;

  const ip = clientIp(request);
  const pairKey = `${ip}|${email}`;
  const blocked = [pairLimiter.peek(pairKey), ipLimiter.peek(ip)].find((state) => !state.allowed);
  if (blocked) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(blocked.retryAfterSeconds) } },
    );
  }

  try {
    const bootstrap = await ensureBootstrapAdmin();
    if (bootstrap === "missing-env") {
      return NextResponse.json(
        { error: "No administrator account exists yet. Configure ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD on the server." },
        { status: 503 },
      );
    }
    const result = await query<AppUserRow>(
      "SELECT id, email, name, role, password_hash, is_active FROM public.app_users WHERE email = $1",
      [email],
    );
    const row = result.rows[0];
    const valid = row ? await verifyPassword(password, row.password_hash) : (await burnPasswordCheck(password), false);
    if (!row || !valid || !row.is_active) {
      pairLimiter.hit(pairKey);
      ipLimiter.hit(ip);
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    pairLimiter.reset(pairKey);
    const token = await signSession({ sub: row.id, email: row.email, name: row.name, role: row.role, fp: passwordFingerprint(row.password_hash) });
    const response = NextResponse.json({ user: toUser(row) });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: "Sign-in is unavailable right now. Check the server configuration." }, { status: 503 });
  }
}
