"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkouts } from "@/hooks/useWorkouts";
import { currentStreakWeeks } from "@/lib/analytics/streak";
import { computePRs } from "@/lib/analytics/personal-records";
import { workoutVolume } from "@/lib/analytics/volume";
import { useLatestBodyweight } from "@/hooks/useLatestBodyweight";

import { Hero } from "@/components/dashboard/Hero";
import { MuscleBalance } from "@/components/dashboard/MuscleBalance";
import { StatStrip } from "@/components/dashboard/StatStrip";
import { TemplatesFromHistory } from "@/components/dashboard/TemplatesFromHistory";
import { TodayProgram } from "@/components/dashboard/TodayProgram";
import { VolumeChart } from "@/components/dashboard/VolumeChart";
import { PRCards } from "@/components/dashboard/PRCards";
import { CoachInsight } from "@/components/dashboard/CoachInsight";
import { Skeleton } from "@/components/ui/Skeleton";

export default function DashboardPage() {
  const { user } = useAuth();
  const { workouts, loading } = useWorkouts();
  const bodyweightKg = useLatestBodyweight();

  const name = (user?.displayName || user?.email?.split("@")[0] || "Athlete").replace(/^./, (c) => c.toUpperCase());

  const streak = useMemo(() => currentStreakWeeks(workouts), [workouts]);
  const prs = useMemo(() => computePRs(workouts), [workouts]);

  const chartData = useMemo(
    () =>
      [...workouts]
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(-10)
        .map((w) => ({
          kg: workoutVolume(w, bodyweightKg),
          label: w.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          date: w.date,
        })),
    [workouts, bodyweightKg],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 rounded-3xl" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <Skeleton className="h-52 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <Hero name={name} workouts={workouts} />

      <TodayProgram />

      <StatStrip workouts={workouts} streak={streak} />

      <TemplatesFromHistory workouts={workouts} />

      <MuscleBalance workouts={workouts} />

      <VolumeChart data={chartData} />

      <PRCards records={prs} />

      <CoachInsight workouts={workouts} />

      <div className="pt-2 pb-1">
        <Link
          href="/coach"
          className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-violet-600/20 to-brand-600/20 border border-violet-500/30 px-4 py-3 group hover:border-violet-500/50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">Ask the coach</span>
          </span>
          <span className="text-xs text-zinc-400 group-hover:text-white transition-colors">→</span>
        </Link>
      </div>
    </div>
  );
}
