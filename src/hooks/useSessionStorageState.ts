"use client";

import { useState } from "react";

type SetStateAction<T> = T | ((prevState: T) => T);

export function useSessionStorageState<T>(
  key: string,
  defaultValue: T,
  isValid?: (value: unknown) => value is T
) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return defaultValue;

      const parsed = JSON.parse(raw) as unknown;
      if (isValid && !isValid(parsed)) return defaultValue;

      return parsed as T;
    } catch {
      return defaultValue;
    }
  });

  function updateState(nextValue: SetStateAction<T>) {
    setState((prev) => {
      const resolved = typeof nextValue === "function" ? (nextValue as (prevState: T) => T)(prev) : nextValue;
      try {
        window.sessionStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Ignore storage write failures and keep the in-memory state.
      }
      return resolved;
    });
  }

  return [state, updateState] as const;
}
