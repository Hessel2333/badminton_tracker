"use client";

import { useEffect, useState } from "react";

type SetStateAction<T> = T | ((prevState: T) => T);

export function useSessionStorageState<T>(
  key: string,
  defaultValue: T,
  isValid?: (value: unknown) => value is T
) {
  const [state, setState] = useState<T>(defaultValue);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return;

      const parsed = JSON.parse(raw) as unknown;
      if (isValid && !isValid(parsed)) return;

      setState(parsed as T);
    } catch {
      // Ignore invalid persisted state and fall back to the default.
    }
  }, [isValid, key]);

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
