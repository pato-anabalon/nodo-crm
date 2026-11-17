"use client";

import { useCallback, useSyncExternalStore } from "react";

const CHANGED = "stored-choice";

/** What was chosen this visit, for when storage refuses to hold it. */
const memory = new Map<string, string>();

/**
 * A per-browser preference that is only about how something looks.
 *
 * `localStorage` is per origin, and each company has its own subdomain, so two
 * companies never share one. The caller adds whatever else should keep two
 * people on the same browser apart (the user's id) to `key`.
 *
 * Read through `useSyncExternalStore` so the server and the first client render
 * agree on `fallback`, and the stored value arrives right after hydration
 * instead of as a mismatch. Every access is wrapped: storage can be blocked, or
 * throw, in a private window, and the screen must still draw.
 */
export function useStoredChoice<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("storage", notify);
    window.addEventListener(CHANGED, notify);
    return () => {
      window.removeEventListener("storage", notify);
      window.removeEventListener(CHANGED, notify);
    };
  }, []);

  const read = useCallback((): T => {
    let stored: string | null | undefined = memory.get(key);
    try {
      stored = window.localStorage.getItem(key) ?? stored;
    } catch {
      // Blocked storage: whatever was chosen this visit is still in `memory`.
    }
    return allowed.find((option) => option === stored) ?? fallback;
  }, [key, allowed, fallback]);

  const value = useSyncExternalStore(subscribe, read, () => fallback);

  const write = useCallback(
    (next: T) => {
      memory.set(key, next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Not remembered next time; `memory` carries it for this visit.
      }
      window.dispatchEvent(new Event(CHANGED));
    },
    [key],
  );

  return [value, write];
}
