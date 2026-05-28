"use client";

import { useEffect, useState } from "react";

const KEY = "ironlog:restTimerEnabled";

/** Whether the rest timer should auto-start on set completion. Default: on. */
export function useRestTimerEnabled() {
  const [enabled, setEnabledState] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw !== null) setEnabledState(raw === "true");
    } catch {
      /* corrupt */
    }
    setHydrated(true);
  }, []);

  const setEnabled = (v: boolean) => {
    setEnabledState(v);
    try {
      localStorage.setItem(KEY, String(v));
    } catch {
      /* quota */
    }
  };

  return { enabled, setEnabled, hydrated };
}
