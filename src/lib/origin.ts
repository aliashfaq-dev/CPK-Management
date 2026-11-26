/**
 * Same-origin check for state-changing requests (CSRF defence in depth on top of SameSite=Strict).
 * Edge-safe: used by middleware.ts and by every mutating route handler.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const expected = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  return originHost === expected;
}

export const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isMutating(request: Request): boolean {
  return !SAFE_METHODS.has(request.method.toUpperCase());
}
