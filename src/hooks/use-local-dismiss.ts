"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Shared hook for localStorage-based persistent dismissal.
 * Defaults to `isDismissed = true` initially to avoid hydration flash,
 * then reads the actual value from localStorage in useEffect.
 */
export function useLocalDismiss(key: string): [boolean, () => void] {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    setIsDismissed(localStorage.getItem(key) === "true");
  }, [key]);

  const dismiss = useCallback(() => {
    localStorage.setItem(key, "true");
    setIsDismissed(true);
  }, [key]);

  return [isDismissed, dismiss];
}
