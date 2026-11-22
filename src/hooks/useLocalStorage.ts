import { useEffect, useState } from "react";

/**
 * State persisted to localStorage. Returns `hydrated` so callers can avoid
 * rendering stale defaults before the stored value has been read.
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore unreadable storage */
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota or privacy-mode errors */
    }
  }, [key, value, hydrated]);

  return [value, setValue, hydrated] as const;
}
