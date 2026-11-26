import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isMutating, isSameOrigin } from "@/lib/origin";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";
import type { User, UserRole } from "@/types";

/** Server-only auth helpers: password hashing, session lookup, route guards, first-admin bootstrap. */

const BCRYPT_COST = 12;
export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** A valid hash of a random string, compared against when the email is unknown so timing does not reveal it. */
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_COST);
export async function burnPasswordCheck(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH);
}

export function passwordFingerprint(hash: string): string {
  return createHash("sha256").update(hash).digest("hex").slice(0, 16);
}

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export interface AppUserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password_hash: string;
  is_active: boolean;
}

export function toUser(row: Pick<AppUserRow, "id" | "email" | "name" | "role">): User {
  return { id: row.id, email: row.email, name: row.name, role: row.role, initials: initialsOf(row.name) };
}

interface CacheEntry {
  row: AppUserRow | null;
  expires: number;
}
interface AuthGlobals {
  __cpkUserCache?: Map<string, CacheEntry>;
  __cpkBootstrapReady?: boolean;
}
const store = globalThis as typeof globalThis & AuthGlobals;
const USER_CACHE_MS = 10_000;

export function clearUserCache(): void {
  store.__cpkUserCache?.clear();
}

async function loadUser(id: string): Promise<AppUserRow | null> {
  const cache = (store.__cpkUserCache ??= new Map());
  const hit = cache.get(id);
  if (hit && hit.expires > Date.now()) return hit.row;
  const result = await query<AppUserRow>("SELECT id, email, name, role, password_hash, is_active FROM public.app_users WHERE id = $1", [id]);
  const row = result.rows[0] ?? null;
  cache.set(id, { row, expires: Date.now() + USER_CACHE_MS });
  return row;
}

/**
 * The signed-in user, or null. Verifies the cookie signature AND re-reads the user row, so a
 * disabled account, a role change or a password change takes effect within seconds.
 */
export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  let row: AppUserRow | null;
  try {
    row = await loadUser(claims.sub);
  } catch {
    return null;
  }
  if (!row || !row.is_active || passwordFingerprint(row.password_hash) !== claims.fp) return null;
  return toUser(row);
}

type Authorized = { user: User } | { response: NextResponse };

/**
 * Every API route calls this itself; middleware is only a second layer.
 * Mutating methods must also be same-origin. `admin: true` requires the admin role.
 */
export async function authorize(request: Request, options: { admin?: boolean } = {}): Promise<Authorized> {
  if (isMutating(request) && !isSameOrigin(request)) {
    return { response: NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 }) };
  }
  const user = await getSessionUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  if (options.admin && user.role !== "admin") {
    return { response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };
  }
  return { user };
}

export type BootstrapState = "ready" | "created" | "missing-env";

/** Creates the first admin from ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD when app_users is empty. */
export async function ensureBootstrapAdmin(): Promise<BootstrapState> {
  if (store.__cpkBootstrapReady) return "ready";
  const count = await query<{ total: string }>("SELECT COUNT(*) AS total FROM public.app_users");
  if (Number(count.rows[0]?.total ?? 0) > 0) {
    store.__cpkBootstrapReady = true;
    return "ready";
  }
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password || password.length < MIN_PASSWORD_LENGTH) return "missing-env";
  const hash = await hashPassword(password);
  await query(
    "INSERT INTO public.app_users (email, name, role, password_hash) VALUES ($1, $2, 'admin', $3) ON CONFLICT (email) DO NOTHING",
    [email, "Administrator", hash],
  );
  store.__cpkBootstrapReady = true;
  return "created";
}

/**
 * Checks whether the server is ready to accept sign-ins. Returns a plain operator-facing message
 * when first-run configuration is missing, without ever exposing environment values or DB URLs.
 */
export async function getLoginSetupNotice(): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return "SESSION_SECRET is not configured on the server. Set SESSION_SECRET (at least 32 characters) in .env.local.";
  }
  try {
    const state = await ensureBootstrapAdmin();
    if (state === "missing-env") {
      return `No administrator account exists yet. Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD (at least ${MIN_PASSWORD_LENGTH} characters) in .env.local and reload this page.`;
    }
    return null;
  } catch {
    return "Database is not ready. Check DATABASE_URL and run npm run db:migrate.";
  }
}
