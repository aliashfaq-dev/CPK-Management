import { useMemo, useSyncExternalStore } from "react";
import { AUTH_EVENT, SESSION_KEY, parseSession } from "@/lib/auth";
import type { AuthSession } from "@/types";

export type AuthState =
  | { status: "loading"; session: null }
  | { status: "unauthenticated"; session: null }
  | { status: "authenticated"; session: AuthSession };

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(AUTH_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(AUTH_EVENT, onChange);
  };
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/** `undefined` on the server and during hydration, so the first render never guesses the session. */
function getServerSnapshot(): undefined {
  return undefined;
}

export function useAuth(): AuthState {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, getSnapshot, getServerSnapshot);
  return useMemo<AuthState>(() => {
    if (raw === undefined) return { status: "loading", session: null };
    const session = parseSession(raw);
    return session ? { status: "authenticated", session } : { status: "unauthenticated", session: null };
  }, [raw]);
}
