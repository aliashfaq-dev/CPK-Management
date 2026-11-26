import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import type { UserRole } from "@/types";

/**
 * Session tokens: HS256-signed JWTs in an httpOnly cookie. This module is edge-safe (it is also
 * imported by middleware.ts), so it must not touch Node-only APIs or the database.
 */

export const SESSION_COOKIE = "cpk_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export interface SessionClaims {
  /** app_users.id */
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  /** Fingerprint of the password hash: changing the password invalidates old sessions. */
  fp: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters (see .env.local.example).");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email, name: claims.name, role: claims.role, fp: claims.fp })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

/** Returns the claims, or null when the token is missing, forged, expired or malformed. */
export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const { sub, email, name, role, fp } = payload;
    if (typeof sub !== "string" || typeof email !== "string" || typeof name !== "string" || typeof fp !== "string") return null;
    if (role !== "admin" && role !== "viewer") return null;
    return { sub, email, name, role, fp };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  // SESSION_COOKIE_SECURE=false allows plain-http LAN access; the default is Secure in production.
  const secure = process.env.SESSION_COOKIE_SECURE ? process.env.SESSION_COOKIE_SECURE !== "false" : process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
