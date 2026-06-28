"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { subscribeToBodyMetrics } from "@/lib/firebase/repository";

/**
 * The user's most recently logged bodyweight in kg, or undefined if none.
 *
 * Used to give bodyweight exercises (0 kg) a sensible load when computing
 * training volume — see {@link exerciseVolume}. Body metrics are returned newest
 * first, so the first entry with a weight is the latest.
 */
export function useLatestBodyweight(): number | undefined {
  const { user } = useAuth();
  const [kg, setKg] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setKg(undefined);
      return;
    }
    return subscribeToBodyMetrics(user.uid, (metrics) => {
      const latest = metrics.find((m) => typeof m.weightKg === "number");
      setKg(latest?.weightKg);
    });
  }, [user]);

  return kg;
}
