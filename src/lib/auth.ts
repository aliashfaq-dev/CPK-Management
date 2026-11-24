/**
 * Demo authentication backed by localStorage. This is NOT real security: the password is stored in plain text
 * in the browser and nothing is verified by a server. Replace with a real auth provider before production.
 */
import type { AuthSession, RegisteredUser } from "@/types";

export const REGISTERED_USER_KEY = "cpk_registered_user";
export const SESSION_KEY = "cpk_auth_session";
/** Same-tab notification; the native `storage` event only fires in other tabs. */
export const AUTH_EVENT = "cpk-auth-change";

export const DEMO_USER: RegisteredUser = {
  email: "ayesha.khan@cpk.gov.pk",
  password: "admin123",
  name: "Ayesha Khan",
  role: "Operations Lead",
};

let signingOut = false;
/** True between a sign-out and the next sign-in, so the route guard shows "Signing out…" instead of "Redirecting…". */
export function isSigningOut(): boolean {
  return signingOut;
}
export function resetSigningOut(): void {
  signingOut = false;
}

export type SignInResult = { ok: true; session: AuthSession } | { ok: false; reason: "invalid" | "storage" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseUser(raw: string | null): RegisteredUser | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (isRecord(value) && typeof value.email === "string" && typeof value.password === "string" && typeof value.name === "string" && typeof value.role === "string") {
      return { email: value.email, password: value.password, name: value.name, role: value.role };
    }
  } catch {
    /* corrupt value: treated as missing */
  }
  return null;
}

export function parseSession(raw: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (isRecord(value) && typeof value.email === "string" && typeof value.name === "string" && typeof value.role === "string") {
      return {
        email: value.email,
        name: value.name,
        role: value.role,
        signedInAt: typeof value.signedInAt === "string" ? value.signedInAt : "",
      };
    }
  } catch {
    /* corrupt value: treated as signed out */
  }
  return null;
}

function notify(): void {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

/** Writes the demo user once; a missing or unreadable record is replaced. */
export function seedDemoUser(): void {
  try {
    if (!parseUser(window.localStorage.getItem(REGISTERED_USER_KEY))) {
      window.localStorage.setItem(REGISTERED_USER_KEY, JSON.stringify(DEMO_USER));
    }
  } catch {
    /* storage unavailable (privacy mode); sign-in will report it */
  }
}

export function signIn(identifier: string, password: string): SignInResult {
  seedDemoUser();
  try {
    const user = parseUser(window.localStorage.getItem(REGISTERED_USER_KEY));
    if (!user) return { ok: false, reason: "storage" };
    if (identifier.trim().toLowerCase() !== user.email.toLowerCase() || password !== user.password) {
      return { ok: false, reason: "invalid" };
    }
    const session: AuthSession = { email: user.email, name: user.name, role: user.role, signedInAt: new Date().toISOString() };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    signingOut = false;
    notify();
    return { ok: true, session };
  } catch {
    return { ok: false, reason: "storage" };
  }
}

export function signOut(): void {
  signingOut = true;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* nothing to clear */
  }
  notify();
}
