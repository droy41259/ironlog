"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarRange, ChevronRight, Dumbbell, Play, Settings2 } from "lucide-react";
import { usePrograms } from "@/hooks/usePrograms";
import { dayAt, clampCursor, missingTrainingMaxes } from "@/lib/programs/resolve";
import { Card } from "@/components/ui/Card";

/**
 * Dashboard "today's workout" pointer. Shows the active program's current day
 * and a one-tap start that deep-links into the logger pre-filled.
 */
export function TodayProgram() {
  const { active, loading } = usePrograms();
  const router = useRouter();

  if (loading) return null;

  // No active program → gentle prompt to start one.
  if (!active) {
    return (
      <Link
        href="/programs"
        className="flex items-center justify-between rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-4 group hover:border-brand-400 transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <CalendarRange className="w-5 h-5 text-brand-500" />
          <span>
            <span className="block text-sm font-bold text-zinc-800 dark:text-white">Follow a program</span>
            <span className="block text-xs text-zinc-500">PPL, 5/3/1, nSuns or build your own</span>
          </span>
        </span>
        <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-brand-500 transition-colors" />
      </Link>
    );
  }

  const cursor = clampCursor(active, active.cursor);
  const day = dayAt(active, cursor);
  const weekLabel = active.weeks[cursor.week]?.label ?? `Week ${cursor.week + 1}`;
  const needsTM = missingTrainingMaxes(active);

  if (!day) {
    return (
      <Card className="p-4">
        <p className="text-sm text-zinc-500">
          {active.name} has no training days yet.{" "}
          <Link href="/programs" className="text-brand-500 font-semibold">Edit it →</Link>
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-500">
            <CalendarRange className="w-3.5 h-3.5" /> Today · {weekLabel}
          </div>
          <h3 className="mt-1 text-lg font-bold text-zinc-900 dark:text-white truncate">{day.label}</h3>
          <p className="text-xs text-zinc-500 truncate">{active.name}</p>
        </div>
        <Link
          href="/programs"
          aria-label="Manage programs"
          className="shrink-0 p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Settings2 className="w-4 h-4" />
        </Link>
      </div>

      <div className="px-4 pb-3 space-y-1.5">
        {day.exercises.slice(0, 5).map((ex, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <Dumbbell className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{ex.name}</span>
            <span className="ml-auto text-xs text-zinc-400 shrink-0">{ex.prescribed.length} sets</span>
          </div>
        ))}
        {day.exercises.length > 5 && (
          <p className="text-xs text-zinc-400 pl-6">+{day.exercises.length - 5} more</p>
        )}
      </div>

      {needsTM.length > 0 && (
        <div className="mx-4 mb-3 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          Set a training max for {needsTM.join(", ")} on the{" "}
          <Link href="/programs" className="underline font-semibold">programs page</Link> for accurate weights.
        </div>
      )}

      <button
        onClick={() => router.push(`/log?program=${active.id}`)}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-500 to-brand-700 text-white font-bold py-3.5 text-sm hover:opacity-95 transition-opacity"
      >
        <Play className="w-4 h-4" fill="currentColor" /> Start today&apos;s workout
      </button>
    </Card>
  );
}
