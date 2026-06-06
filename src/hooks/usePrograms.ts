"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { subscribeToPrograms } from "@/lib/firebase/repository";
import type { Program } from "@/types/program";

export function usePrograms() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPrograms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToPrograms(user.uid, (p) => {
      setPrograms(p);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const active = useMemo(() => programs.find((p) => p.active) ?? null, [programs]);

  return { programs, active, loading };
}
