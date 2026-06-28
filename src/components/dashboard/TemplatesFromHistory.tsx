"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Layers, Clock, Play } from "lucide-react";
import type { Workout } from "@/types/workout";
import { useUnits } from "@/providers/UnitsProvider";
import { formatWeight } from "@/lib/units/converter";
import { workoutVolume } from "@/lib/analytics/volume";
import { useLatestBodyweight } from "@/hooks/useLatestBodyweight";
import { daysAgo } from "@/lib/utils";

/**
 * Templates surfaced from past workouts. We group by workout name (case-insensitive)
 * and surface the top 3 most-frequent — those are the routines you actually do.
 * Each card uses the most-recent occurrence as the "current best version" of that template.
 */
export function TemplatesFromHistory({ workouts }: { workouts: Workout[] }) {
  const { units } = useUnits();
  const bodyweightKg = useLatestBodyweight();

  const templates = useMemo(() => {
    const groups = new Map<string, { count: number; latest: Workout }>();
    for (const w of workouts) {
      const key = w.name.trim().toLowerCase();
      if (!key) continue;
      const existing = groups.get(key);
      if (!existing) groups.set(key, { count: 1, latest: w });
      else {
        existing.count += 1;
        if (w.date.getTime() > existing.latest.date.getTime()) existing.latest = w;
      }
    }
    return [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  }, [workouts]);

  if (templates.length === 0) {
    return (
      <Link
        href="/log"
        className="block rounded-3xl border-2 border-dashed border-zinc-300 dark:border-zinc-800 p-8 text-center hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-colors"
      >
        <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-500/10 flex items-center justify-center mb-3">
          <Play className="w-6 h-6 text-brand-500 fill-current" />
        </div>
        <p className="font-bold text-zinc-800 dark:text-white">Start your first workout</p>
        <p className="text-xs text-zinc-500 mt-1">Your routines will appear here as templates.</p>
      </Link>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-brand-500 dark:text-brand-400" /> Your routines
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
          Tap to repeat
        </span>
      </div>
      <div className="space-y-2.5">
        {templates.map((t) => (
          <Link
            key={t.latest.id}
            href={`/log?repeat=${t.latest.id}`}
            className="group block rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-4 hover:border-brand-400 dark:hover:border-brand-500/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-zinc-900 dark:text-white text-base truncate">{t.latest.name}</h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-1.5 py-0.5 rounded shrink-0">
                    {t.count}×
                  </span>
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {daysAgo(t.latest.date)}
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-700">·</span>
                  <span>{t.latest.exercises.length} ex</span>
                  <span className="text-zinc-300 dark:text-zinc-700">·</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatWeight(workoutVolume(t.latest, bodyweightKg), units, 0)}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {t.latest.exercises.slice(0, 4).map((ex) => (
                <span
                  key={ex.id}
                  className="text-[10px] text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded truncate max-w-[120px]"
                >
                  {ex.name}
                </span>
              ))}
              {t.latest.exercises.length > 4 && (
                <span className="text-[10px] text-zinc-500 px-1.5 py-0.5">
                  +{t.latest.exercises.length - 4}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
