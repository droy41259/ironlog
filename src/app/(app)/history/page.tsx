"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar, Trash2, ChevronDown, ChevronUp, Dumbbell, Repeat, Download,
  Sparkles, Loader2, Zap, Activity,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useToast } from "@/providers/ToastProvider";
import { useUnits } from "@/providers/UnitsProvider";
import { deleteWorkout } from "@/lib/firebase/repository";
import { callGemini } from "@/lib/ai/gemini-client";
import { HISTORY_ANALYZER_SYSTEM_PROMPT } from "@/lib/ai/system-prompts";
import { Card } from "@/components/ui/Card";
import { Confirm } from "@/components/ui/Confirm";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { formatWeight } from "@/lib/units/converter";
import { formatDate } from "@/lib/utils";

export default function HistoryPage() {
  const { user } = useAuth();
  const { workouts, loading } = useWorkouts();
  const { units } = useUnits();
  const toast = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const stats = useMemo(() => {
    const totalSessions = workouts.length;
    const totalVolume = workouts.reduce((a, w) => a + w.totalVolume, 0);
    return { totalSessions, totalVolume };
  }, [workouts]);

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteWorkout(user.uid, id);
      toast.success("Workout deleted");
    } catch {
      toast.error("Couldn't delete. Try again.");
    }
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(workouts, null, 2)], { type: "application/json" });
    download(blob, `ironlog_${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleExportCSV = () => {
    const rows: string[] = ["date,workout,exercise,set,kg,reps,rpe"];
    for (const w of workouts) {
      const date = w.date.toISOString().slice(0, 10);
      for (const ex of w.exercises) {
        ex.sets.forEach((s, i) =>
          rows.push([date, csv(w.name), csv(ex.name), i + 1, s.kg, s.reps, s.rpe ?? ""].join(",")),
        );
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    download(blob, `ironlog_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const analyze = async () => {
    if (workouts.length === 0) return;
    setAnalyzing(true);
    try {
      const ctx = workouts.slice(0, 20).map((w) => ({
        date: w.date.toLocaleDateString(),
        title: w.name,
        volume: Math.round(w.totalVolume),
        exercises: w.exercises.map((e) => e.name).join(", "),
      }));
      const prompt = `Analyze user's last 20 workouts: ${JSON.stringify(ctx)}. Return JSON: {"analysis": "string"}.`;
      const result = await callGemini<{ analysis: string }>(prompt, HISTORY_ANALYZER_SYSTEM_PROMPT, { jsonMode: true });
      setSummary(result?.analysis ?? "Couldn't generate a summary.");
    } catch {
      toast.error("Couldn't analyze right now.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">History</h1>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full">
            {stats.totalSessions} · {formatWeight(stats.totalVolume, units, 0)}
          </span>
        </div>
      </header>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={handleExportJSON} className="flex-1">
          <Download className="w-4 h-4" /> JSON
        </Button>
        <Button variant="secondary" size="sm" onClick={handleExportCSV} className="flex-1">
          <Download className="w-4 h-4" /> CSV
        </Button>
      </div>

      {workouts.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-500 to-brand-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10" aria-hidden>
            <Activity size={100} />
          </div>
          <div className="relative z-10">
            <h2 className="font-bold flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-yellow-300" /> Progress report
            </h2>
            {analyzing ? (
              <div className="flex items-center gap-2 text-indigo-100 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Analyzing {Math.min(20, workouts.length)} session{Math.min(20, workouts.length) === 1 ? "" : "s"}…
              </div>
            ) : summary ? (
              <p className="text-sm leading-relaxed text-indigo-50">{summary}</p>
            ) : (
              <button
                onClick={analyze}
                className="mt-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-2 min-h-[40px]"
              >
                <Zap className="w-3 h-3" /> Analyze history
              </button>
            )}
            {summary && (
              <button onClick={() => setSummary(null)} className="text-xs text-indigo-200 hover:underline mt-3">
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : workouts.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="w-6 h-6" />}
          title="No workouts logged yet"
          description="Your sessions will land here as soon as you finish your first."
          action={
            <Link href="/log">
              <Button>Start your first</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {workouts.map((w) => {
            const open = expanded === w.id;
            return (
              <Card key={w.id} className={`overflow-hidden ${open ? "ring-2 ring-brand-200 dark:ring-brand-500/30" : ""}`}>
                <button
                  onClick={() => setExpanded(open ? null : w.id)}
                  className="w-full p-4 text-left"
                  aria-expanded={open}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-zinc-900 dark:text-white text-base truncate min-w-0 flex-1">{w.name}</h3>
                    <span className="text-zinc-400 shrink-0">
                      {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 flex items-center gap-x-2 gap-y-1 flex-wrap mt-1">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(w.date, "weekday")}
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">·</span>
                    <span>{w.exercises.length} ex</span>
                    <span className="text-zinc-300 dark:text-zinc-700">·</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatWeight(w.totalVolume, units, 0)}</span>
                  </div>
                </button>
                <div className="flex divide-x divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800">
                  <Link
                    href={`/log?repeat=${w.id}`}
                    aria-label="Repeat this workout"
                    className="flex-1 py-2.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Repeat className="w-3.5 h-3.5" /> Repeat
                  </Link>
                  <Confirm
                    title="Delete workout?"
                    message={`This deletes "${w.name}" permanently. Your other workouts are safe.`}
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => handleDelete(w.id)}
                    trigger={(openConfirm) => (
                      <button
                        onClick={openConfirm}
                        aria-label="Delete workout"
                        className="flex-1 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}
                  />
                </div>
                {open && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 p-5 bg-zinc-50/50 dark:bg-zinc-800/40 space-y-4">
                    {w.exercises.map((ex) => (
                      <div key={ex.id} className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-100 dark:border-zinc-800">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-zinc-800 dark:text-white">{ex.name}</h4>
                            {ex.notes && <p className="text-xs text-zinc-500 italic mt-0.5">&ldquo;{ex.notes}&rdquo;</p>}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {ex.sets.map((s, i) => (
                            <div key={i} className="bg-zinc-50 dark:bg-zinc-800 p-2 rounded text-center">
                              <div className="text-[10px] text-zinc-400 uppercase font-bold">Set {i + 1}</div>
                              <div className="font-mono text-sm text-zinc-800 dark:text-zinc-200">
                                <span className="font-bold">{formatWeight(s.kg, units, 0)}</span> × {s.reps}
                                {typeof s.rpe === "number" && (
                                  <span className="text-[10px] text-violet-500 ml-1">RPE {s.rpe}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function csv(s: string) {
  const needsQuote = /[",\n]/.test(s);
  return needsQuote ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
