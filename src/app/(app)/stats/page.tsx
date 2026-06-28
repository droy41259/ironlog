"use client";

import { useEffect, useMemo, useState } from "react";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useUnits } from "@/providers/UnitsProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { fromKg, toKg } from "@/lib/units/converter";
import { estimate1RM } from "@/lib/analytics/onerm";
import { workoutSetCount, workoutVolume } from "@/lib/analytics/volume";
import { useLatestBodyweight } from "@/hooks/useLatestBodyweight";
import { addBodyMetric, subscribeToBodyMetrics } from "@/lib/firebase/repository";
import type { BodyMetric } from "@/types/workout";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { BarChart3, TrendingUp, Flame, Calendar, Scale, Plus } from "lucide-react";

/** Per-exercise 1RM progression over time. */
function ProgressionChart({ data, color = "#3b82f6" }: { data: { date: Date; v: number }[]; color?: string }) {
  if (data.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-zinc-500 italic">
        Need at least 2 sessions to draw a trend.
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.v));
  const min = Math.min(...data.map((d) => d.v));
  const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * 100;
  const y = (v: number) => 100 - ((v - min) / range) * 90 - 5;
  const points = data.map((d, i) => `${x(i)},${y(d.v)}`).join(" ");
  const area = `0,100 ${points} 100,100`;
  return (
    <svg viewBox="0 0 100 100" className="w-full h-32" preserveAspectRatio="none">
      <defs>
        <linearGradient id="prog-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#prog-grad)" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.v)} r="1" fill={color} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export default function StatsPage() {
  const { workouts, loading } = useWorkouts();
  const { units } = useUnits();
  const bodyweightKg = useLatestBodyweight();

  // Exercises that show up most often, for the picker
  const exercises = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of workouts) for (const ex of w.exercises) counts.set(ex.name, (counts.get(ex.name) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [workouts]);

  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? exercises[0] ?? null;

  // Best 1RM per session for the picked exercise
  const progression = useMemo(() => {
    if (!selected) return [];
    const rows: { date: Date; v: number }[] = [];
    const sorted = [...workouts].sort((a, b) => a.date.getTime() - b.date.getTime());
    for (const w of sorted) {
      let best = 0;
      for (const ex of w.exercises) {
        if (ex.name === selected) {
          for (const s of ex.sets) {
            if (!s.completed) continue;
            const est = estimate1RM(s.kg, s.reps);
            if (est > best) best = est;
          }
        }
      }
      if (best > 0) rows.push({ date: w.date, v: fromKg(best, units) });
    }
    return rows;
  }, [workouts, selected, units]);

  // Training emphasis: every completed set bucketed by rep range. This uses the
  // whole history (no time window), so it stays useful no matter when you trained.
  const repRanges = useMemo(() => {
    let strength = 0; // 1–5 reps
    let hypertrophy = 0; // 6–12 reps
    let endurance = 0; // 13+ reps
    for (const w of workouts) {
      for (const ex of w.exercises ?? []) {
        for (const s of ex.sets ?? []) {
          if (!s.completed) continue;
          const reps = Number.isFinite(s.reps) ? s.reps : 0;
          if (reps <= 0) continue;
          if (reps <= 5) strength++;
          else if (reps <= 12) hypertrophy++;
          else endurance++;
        }
      }
    }
    return { strength, hypertrophy, endurance, total: strength + hypertrophy + endurance };
  }, [workouts]);

  const totals = useMemo(() => {
    const sessions = workouts.length;
    const sets = workouts.reduce((a, w) => a + workoutSetCount(w), 0);
    const volume = workouts.reduce((a, w) => a + workoutVolume(w, bodyweightKg), 0);
    return { sessions, sets, volume };
  }, [workouts, bodyweightKg]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-60 rounded-3xl" />
        <Skeleton className="h-60 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Stats</h1>

      {/* Lifetime totals */}
      <div className="grid grid-cols-3 gap-2">
        <TotalCard icon={<Flame className="w-4 h-4" />} label="Sessions" value={totals.sessions.toString()} color="text-amber-500 dark:text-amber-400" bg="bg-amber-500/10" />
        <TotalCard icon={<TrendingUp className="w-4 h-4" />} label="Sets" value={totals.sets.toString()} color="text-brand-600 dark:text-brand-400" bg="bg-brand-500/10" />
        <TotalCard
          icon={<BarChart3 className="w-4 h-4" />}
          label={`Volume (${units})`}
          value={Math.round(fromKg(totals.volume, units) / 1000).toLocaleString() + "k"}
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-500/10"
        />
      </div>

      {/* Per-exercise 1RM progression */}
      <section className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-white text-sm">Estimated 1RM</h3>
            <p className="text-xs text-zinc-500">Top set per session, Epley + Brzycki</p>
          </div>
          {exercises.length > 0 && (
            <select
              value={selected ?? ""}
              onChange={(e) => setPicked(e.target.value)}
              className="bg-zinc-100 dark:bg-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 max-w-[150px]"
            >
              {exercises.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
          )}
        </div>
        {progression.length > 0 && (
          <div className="flex items-baseline gap-2 mb-2">
            <span
              className="text-3xl font-bold text-zinc-900 dark:text-white leading-none"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {progression[progression.length - 1]!.v.toFixed(0)}
            </span>
            <span className="text-xs text-zinc-500 font-semibold">{units}</span>
            {progression.length > 1 && (() => {
              const first = progression[0]!.v;
              const last = progression[progression.length - 1]!.v;
              const delta = last - first;
              if (Math.abs(delta) < 0.5) return null;
              return (
                <span
                  className={`text-xs font-bold ml-2 ${delta > 0 ? "text-emerald-500" : "text-red-500"}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {delta > 0 ? "+" : ""}{delta.toFixed(0)} {units} all-time
                </span>
              );
            })()}
          </div>
        )}
        <ProgressionChart data={progression} />
      </section>

      {/* Training emphasis — rep-range distribution */}
      <RepRangeSection ranges={repRanges} />

      {/* Frequency calendar */}
      <MonthCalendar workouts={workouts} />

      {/* Bodyweight */}
      <BodyweightSection />
    </div>
  );
}

function BodyweightSection() {
  const { user } = useAuth();
  const { units } = useUnits();
  const toast = useToast();
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToBodyMetrics(user.uid, setMetrics);
  }, [user]);

  const log = async () => {
    if (!user) return;
    const num = parseFloat(input.replace(",", "."));
    if (!Number.isFinite(num) || num <= 0 || num > 500) {
      toast.error("Enter a valid weight.");
      return;
    }
    setSaving(true);
    try {
      await addBodyMetric(user.uid, { date: new Date(), weightKg: toKg(num, units) });
      setInput("");
      toast.success("Logged");
    } catch {
      toast.error("Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const series = useMemo(
    () =>
      metrics
        .filter((m) => typeof m.weightKg === "number")
        .slice(0, 60)
        .reverse()
        .map((m) => ({ date: m.date, v: fromKg(m.weightKg!, units) })),
    [metrics, units],
  );

  const latest = series[series.length - 1];
  const oldest = series[0];
  const delta = latest && oldest ? latest.v - oldest.v : 0;

  return (
    <section className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-1.5">
            <Scale className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Bodyweight
          </h3>
          <p className="text-xs text-zinc-500">Daily or weekly check-in</p>
        </div>
        {latest && (
          <div className="text-right">
            <div className="text-xl font-bold text-zinc-900 dark:text-white leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>
              {latest.v.toFixed(1)}
              <span className="text-xs text-zinc-500 font-semibold ml-1">{units}</span>
            </div>
            {Math.abs(delta) >= 0.1 && (
              <div className={`text-[10px] font-bold mt-0.5 ${delta > 0 ? "text-amber-500" : "text-emerald-500"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                {delta > 0 ? "+" : ""}{delta.toFixed(1)} {units} all-time
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          inputMode="decimal"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Today's weight (${units})`}
          className="flex-1 bg-zinc-50 dark:bg-zinc-800 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-brand-500 outline-none placeholder-zinc-400 dark:placeholder-zinc-600"
          style={{ fontVariantNumeric: "tabular-nums" }}
        />
        <Button onClick={log} loading={saving} size="sm" className="shrink-0">
          <Plus className="w-4 h-4" /> Log
        </Button>
      </div>

      {series.length >= 2 ? (
        <BodyweightChart data={series} />
      ) : series.length === 1 ? (
        <p className="text-xs text-zinc-500 italic text-center py-4">One more entry and the trend appears.</p>
      ) : (
        <p className="text-xs text-zinc-500 italic text-center py-4">No bodyweight logged yet.</p>
      )}
    </section>
  );
}

function BodyweightChart({ data }: { data: { date: Date; v: number }[] }) {
  const max = Math.max(...data.map((d) => d.v));
  const min = Math.min(...data.map((d) => d.v));
  const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * 100;
  const y = (v: number) => 100 - ((v - min) / range) * 80 - 10;
  const points = data.map((d, i) => `${x(i)},${y(d.v)}`).join(" ");
  const area = `0,100 ${points} 100,100`;

  return (
    <div>
      <div className="flex justify-between text-[10px] text-zinc-400 mb-1 px-0.5" style={{ fontVariantNumeric: "tabular-nums" }}>
        <span>{max.toFixed(1)}</span>
        <span>{min.toFixed(1)}</span>
      </div>
      <svg viewBox="0 0 100 100" className="w-full h-32" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bw-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#bw-grad)" />
        <polyline
          points={points}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.v)} r="1.2" fill="#10b981" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-zinc-400 mt-1 px-0.5">
        <span>{data[0]?.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        <span>{data[data.length - 1]?.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
      </div>
    </div>
  );
}

function RepRangeSection({
  ranges,
}: {
  ranges: { strength: number; hypertrophy: number; endurance: number; total: number };
}) {
  const rows = [
    { key: "strength", label: "Strength", hint: "1–5 reps", color: "#ef4444", count: ranges.strength },
    { key: "hypertrophy", label: "Hypertrophy", hint: "6–12 reps", color: "#3b82f6", count: ranges.hypertrophy },
    { key: "endurance", label: "Endurance", hint: "13+ reps", color: "#10b981", count: ranges.endurance },
  ];
  const top = rows.reduce((a, b) => (b.count > a.count ? b : a), rows[0]!);

  return (
    <section className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm">Training emphasis</h3>
          <p className="text-xs text-zinc-500">Completed sets by rep range</p>
        </div>
        {ranges.total > 0 && (
          <div className="text-right">
            <div className="text-xl font-bold text-zinc-900 dark:text-white leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>
              {ranges.total}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mt-0.5">Sets</div>
          </div>
        )}
      </div>

      {ranges.total === 0 ? (
        <p className="text-xs text-zinc-500 italic text-center py-8">
          Complete some sets to see your rep-range split.
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {rows.map((r) => {
              const pct = Math.round((r.count / ranges.total) * 100);
              return (
                <li key={r.key} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                        {r.label}{" "}
                        <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">{r.hint}</span>
                      </span>
                      <span className="text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                        <span className="text-zinc-700 dark:text-zinc-300 font-semibold">{pct}%</span>
                        <span className="text-zinc-400 dark:text-zinc-600"> · {r.count}</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: r.color }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-zinc-500 mt-4">
            Most of your work is in the{" "}
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{top.label.toLowerCase()}</span> range.
          </p>
        </>
      )}
    </section>
  );
}

function TotalCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-3">
      <div className={`p-1.5 rounded-lg inline-flex ${bg} ${color}`}>{icon}</div>
      <div className="text-xl font-bold text-zinc-900 dark:text-white mt-2 leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mt-1">{label}</div>
    </div>
  );
}

interface DayCell {
  key: string;
  date: Date;
  workouts: number;
  sets: number;
}

function MonthCalendar({ workouts }: { workouts: { date: Date; exercises: { sets: { completed: boolean }[] }[] }[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const [picked, setPicked] = useState(thisKey);
  const [hover, setHover] = useState<DayCell | null>(null);

  // Build month options: every month with data + the current month, last 12 max
  const monthOptions = useMemo(() => {
    const set = new Set<string>([thisKey]);
    for (const w of workouts) {
      const d = w.date;
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return [...set]
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 12)
      .map((k) => {
        const [y, m] = k.split("-").map(Number);
        const d = new Date(y!, m! - 1, 1);
        return { key: k, label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }) };
      });
  }, [workouts, thisKey]);

  // Aggregate workouts + completed sets per day
  const dayMap = useMemo(() => {
    const map = new Map<string, { workouts: number; sets: number }>();
    for (const w of workouts) {
      const d = new Date(w.date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const sets = w.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.completed).length, 0);
      const existing = map.get(k) ?? { workouts: 0, sets: 0 };
      map.set(k, { workouts: existing.workouts + 1, sets: existing.sets + sets });
    }
    return map;
  }, [workouts]);

  // Build the calendar grid for the picked month
  const [py, pm] = picked.split("-").map(Number);
  const firstOfMonth = new Date(py!, pm! - 1, 1);
  const lastOfMonth = new Date(py!, pm!, 0);
  const startWeekday = firstOfMonth.getDay(); // 0 = Sun

  const cells: (DayCell | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= lastOfMonth.getDate(); d++) {
    const date = new Date(py!, pm! - 1, d);
    const k = `${py}-${String(pm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const stats = dayMap.get(k) ?? { workouts: 0, sets: 0 };
    cells.push({ key: k, date, workouts: stats.workouts, sets: stats.sets });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  // Color scale based on set count per day
  const color = (sets: number) => {
    if (sets === 0) return "bg-zinc-100 dark:bg-zinc-800/60";
    if (sets <= 5) return "bg-brand-500/30";
    if (sets <= 12) return "bg-brand-500/55";
    if (sets <= 20) return "bg-brand-500/80";
    return "bg-brand-500";
  };

  const monthStats = useMemo(() => {
    let totalSessions = 0;
    let totalSets = 0;
    for (const c of cells) {
      if (c) {
        totalSessions += c.workouts;
        totalSets += c.sets;
      }
    }
    return { totalSessions, totalSets };
  }, [cells]);

  return (
    <section className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-1.5">
            <Calendar className="w-4 h-4" /> Training frequency
          </h3>
          <p className="text-xs text-zinc-500">
            {monthStats.totalSessions} session{monthStats.totalSessions === 1 ? "" : "s"} · {monthStats.totalSets} sets
          </p>
        </div>
        <select
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          className="bg-zinc-100 dark:bg-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500 max-w-[170px]"
        >
          {monthOptions.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1 mb-1 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-[10px] text-zinc-400 dark:text-zinc-600 font-bold uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="relative grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={`empty-${i}`} className="aspect-square" />;
          const isToday = c.date.getTime() === today.getTime();
          return (
            <button
              key={c.key}
              type="button"
              onMouseEnter={() => setHover(c)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(c)}
              onClick={() => setHover(c)}
              aria-label={`${c.date.toDateString()}: ${c.workouts} workouts, ${c.sets} sets`}
              className={`aspect-square rounded-md flex items-center justify-center text-[10px] font-semibold transition-colors ${color(c.sets)} ${
                c.sets > 12 ? "text-white" : "text-zinc-700 dark:text-zinc-300"
              } ${isToday ? "ring-2 ring-brand-500 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900" : ""}`}
            >
              {c.date.getDate()}
            </button>
          );
        })}
      </div>

      {/* Tooltip strip */}
      <div className="mt-3 min-h-[28px] text-xs text-zinc-600 dark:text-zinc-400">
        {hover ? (
          <span>
            <strong className="text-zinc-900 dark:text-white">
              {hover.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </strong>
            {" — "}
            {hover.workouts === 0 ? (
              <span className="text-zinc-500">Rest day</span>
            ) : (
              <>
                <strong className="text-zinc-800 dark:text-zinc-200">{hover.workouts}</strong> workout
                {hover.workouts === 1 ? "" : "s"} ·{" "}
                <strong className="text-zinc-800 dark:text-zinc-200">{hover.sets}</strong> set
                {hover.sets === 1 ? "" : "s"}
              </>
            )}
          </span>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-600">Tap a day for details</span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 mt-3 text-[10px] text-zinc-500">
        <span>Less</span>
        <span className="w-2.5 h-2.5 rounded-sm bg-zinc-100 dark:bg-zinc-800/60" />
        <span className="w-2.5 h-2.5 rounded-sm bg-brand-500/30" />
        <span className="w-2.5 h-2.5 rounded-sm bg-brand-500/55" />
        <span className="w-2.5 h-2.5 rounded-sm bg-brand-500/80" />
        <span className="w-2.5 h-2.5 rounded-sm bg-brand-500" />
        <span>More</span>
      </div>
    </section>
  );
}
