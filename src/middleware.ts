import { NextResponse, type NextRequest } from "next/server";
import { isMutating, isSameOrigin } from "@/lib/origin";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

/**
 * First gate for every page and API route. It only checks the signed cookie (no database in
 * the edge runtime); every route handler repeats the session, role and origin checks itself
 * against the database, so this layer is never the only protection.
 */

const PUBLIC_PAGES = new Set(["/login"]);
// Mutating API routes that any signed-in user (including viewers) may call.
const VIEWER_WRITES = [/^\/api\/auth\/(logout|password)$/, /^\/api\/assistant$/];

function json(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (pathname.startsWith("/api/auth/") || PUBLIC_PAGES.has(pathname)) {
    return NextResponse.next();
  }

  if (isApi && isMutating(request) && !isSameOrigin(request)) {
    return json(403, "Cross-origin request rejected.");
  }

  let claims = null;
  try {
    claims = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  } catch {
    // Misconfigured SESSION_SECRET: fail closed.
    return isApi ? json(503, "Server is not configured.") : NextResponse.redirect(new URL("/login", request.url));
  }

  if (!claims) {
    if (isApi) return json(401, "Sign in required.");
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (isApi && isMutating(request) && claims.role !== "admin" && !VIEWER_WRITES.some((pattern) => pattern.test(pathname))) {
    return json(403, "Administrator access required.");
  }
  if (pathname.startsWith("/api/admin/") && claims.role !== "admin") {
    return json(403, "Administrator access required.");
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|videos/|stream.mp4).*)"],
};
