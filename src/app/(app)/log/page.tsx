"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, Trash2, Save, Calendar, Settings2, TrendingUp, MessageSquareQuote,
  Sparkles, Link as LinkIcon, ChevronUp, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useDraft } from "@/hooks/useDraft";
import { useToast } from "@/providers/ToastProvider";
import { useUnits } from "@/providers/UnitsProvider";
import { saveWorkout, advanceProgramCursor } from "@/lib/firebase/repository";
import { useCustomExercises } from "@/hooks/useCustomExercises";
import { usePrograms } from "@/hooks/usePrograms";
import { useLatestBodyweight } from "@/hooks/useLatestBodyweight";
import { resolveDay, nextCursor, clampCursor } from "@/lib/programs/resolve";
import { workoutVolume } from "@/lib/analytics/volume";
import { lastSessionFor } from "@/lib/analytics/personal-records";
import { findExercise } from "@/lib/data/exercises";
import { MUSCLE_LABELS } from "@/lib/analytics/muscle-groups";
import { uid } from "@/lib/utils";
import type { Exercise, MuscleGroup, WorkoutSet } from "@/types/workout";
import type { ProgramRef } from "@/types/program";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Confirm } from "@/components/ui/Confirm";
import { SetRow } from "@/components/workout/SetRow";
import { ExerciseAutocomplete } from "@/components/workout/ExerciseAutocomplete";
import { PlateCalculator } from "@/components/workout/PlateCalculator";
import { useTimer } from "@/providers/TimerProvider";
import { useRestTimerEnabled } from "@/hooks/useRestTimerEnabled";
import { RestTimer } from "@/components/workout/RestTimer";
import { AIGenerateModal } from "@/components/workout/AIGenerateModal";

interface Draft {
  name: string;
  exercises: Exercise[];
  startedAt: number;
  /** Set when this session was started from a program day. */
  programRef?: ProgramRef;
}

function blankExercise(name = ""): Exercise {
  return {
    id: uid(),
    name,
    notes: "",
    restSec: 90,
    sets: [{ id: uid(), kg: 0, reps: 0, completed: false }],
  };
}

// useSearchParams() must sit under a Suspense boundary for the static export
// (and for streaming SSR on web). Keep the page logic in an inner component.
export default function LogPage() {
  return (
    <Suspense fallback={null}>
      <LogPageInner />
    </Suspense>
  );
}

function LogPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { units: _units } = useUnits();
  const { workouts } = useWorkouts();
  const { exercises: customExercises, upsert: upsertCustomExercise } = useCustomExercises();
  const { programs } = usePrograms();
  const bodyweightKg = useLatestBodyweight();

  const [draft, setDraft, clearDraft] = useDraft<Draft>(user?.uid, "draft", {
    name: "Evening Lift",
    exercises: [blankExercise("Bench Press")],
    startedAt: Date.now(),
  });

  const [aiOpen, setAiOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useTimer();
  const { enabled: timerEnabled } = useRestTimerEnabled();

  // Handle ?repeat=workoutId pre-fill
  useEffect(() => {
    const repeatId = params.get("repeat");
    if (!repeatId) return;
    const source = workouts.find((w) => w.id === repeatId);
    if (!source) return;
    setDraft({
      name: source.name,
      startedAt: Date.now(),
      exercises: source.exercises.map((ex) => ({
        ...ex,
        id: uid(),
        sets: ex.sets.map((s) => ({ ...s, id: uid(), completed: false })),
      })),
    });
    router.replace("/log");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, workouts.length]);

  // Handle ?program=programId pre-fill — resolves the program's current cursor day.
  useEffect(() => {
    const programId = params.get("program");
    if (!programId) return;
    const program = programs.find((p) => p.id === programId);
    if (!program) return;
    const resolved = resolveDay(program);
    if (!resolved) return;
    const c = clampCursor(program, program.cursor);
    setDraft({
      name: resolved.name,
      startedAt: Date.now(),
      exercises: resolved.exercises,
      programRef: {
        id: program.id,
        programName: program.name,
        week: c.week,
        day: c.day,
        dayLabel: program.weeks[c.week]?.days[c.day]?.label ?? "Day",
      },
    });
    router.replace("/log");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, programs.length]);

  const groups = useMemo(() => groupBySupersets(draft.exercises), [draft.exercises]);

  // ─── Mutators ──────────────────────────────────────────────────────
  const setExercises = (next: Exercise[]) => setDraft({ ...draft, exercises: next });

  const addExercise = () => setExercises([...draft.exercises, blankExercise()]);

  const addSuperset = (afterId: string, supersetId?: string | null) => {
    const sid = supersetId ?? uid();
    const next = draft.exercises.flatMap((ex) => {
      if (ex.id === afterId) {
        return [
          { ...ex, supersetId: sid },
          { ...blankExercise(), supersetId: sid },
        ];
      }
      return [ex];
    });
    setExercises(next);
  };

  const removeExercise = (id: string) =>
    setExercises(draft.exercises.filter((e) => e.id !== id));

  /** Move an entire group (single exercise OR full superset) up or down. */
  const moveGroup = (groupIndex: number, direction: -1 | 1) => {
    const grouped = groupBySupersets(draft.exercises);
    const target = groupIndex + direction;
    if (target < 0 || target >= grouped.length) return;
    const next = [...grouped];
    const temp = next[groupIndex]!;
    next[groupIndex] = next[target]!;
    next[target] = temp;
    setExercises(next.flat());
  };

  const updateExercise = (id: string, patch: Partial<Exercise>) =>
    setExercises(draft.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const addSet = (exId: string) =>
    setExercises(
      draft.exercises.map((e) =>
        e.id !== exId
          ? e
          : {
              ...e,
              sets: [
                ...e.sets,
                {
                  id: uid(),
                  kg: e.sets[e.sets.length - 1]?.kg ?? 0,
                  reps: e.sets[e.sets.length - 1]?.reps ?? 0,
                  completed: false,
                },
              ],
            },
      ),
    );

  const updateSet = (exId: string, setId: string, patch: Partial<WorkoutSet>) =>
    setExercises(
      draft.exercises.map((e) =>
        e.id !== exId
          ? e
          : { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) },
      ),
    );

  const removeSet = (exId: string, setId: string) =>
    setExercises(
      draft.exercises.map((e) =>
        e.id !== exId ? e : { ...e, sets: e.sets.filter((s) => s.id !== setId) },
      ),
    );

  // ─── Finish workout ────────────────────────────────────────────────
  const finish = async () => {
    if (!user) return;
    const valid = draft.exercises
      .filter((e) => e.name.trim() && e.sets.some((s) => s.completed))
      .map((e) => ({
        ...e,
        sets: e.sets.filter((s) => s.completed && s.kg >= 0 && s.reps >= 0),
      }));
    if (valid.length === 0) {
      toast.error("Nothing to save — mark at least one set as completed.");
      return;
    }
    setSaving(true);
    try {
      await saveWorkout(user.uid, {
        name: draft.name.trim() || "Workout",
        exercises: valid,
        totalVolume: workoutVolume({ exercises: valid }, bodyweightKg),
        durationSec: Math.round((Date.now() - draft.startedAt) / 1000),
        programRef: draft.programRef,
      });

      // If this session came from a program, advance its cursor to the next day.
      if (draft.programRef) {
        const program = programs.find((p) => p.id === draft.programRef!.id);
        if (program) {
          try {
            await advanceProgramCursor(
              user.uid,
              program.id,
              nextCursor(program, { week: draft.programRef.week, day: draft.programRef.day }),
            );
          } catch {
            // Non-fatal: the workout is already saved.
          }
        }
      }

      // Save any custom exercises (with muscle tags) to the user's local library
      // so they appear in autocomplete next time. Local-only — no network, no rules.
      const seen = new Set<string>();
      for (const e of valid) {
        if (findExercise(e.name)) continue; // library hit, skip
        if (!e.muscles || e.muscles.length === 0) continue;
        const k = e.name.trim().toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        upsertCustomExercise(e.name, e.muscles);
      }

      clearDraft();
      timer.cancel();
      toast.success("Workout saved");
      router.push("/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-32">
      {/* Header */}
      <Card className="p-4">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
              Session
            </label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              maxLength={80}
              className="text-2xl font-bold text-zinc-800 dark:text-white bg-transparent w-full focus:outline-none placeholder-zinc-300"
              placeholder="e.g. Leg Day"
            />
          </div>
          <button
            onClick={() => setAiOpen(true)}
            aria-label="Generate workout with AI"
            className="bg-gradient-to-br from-violet-500 to-purple-600 text-white p-2.5 rounded-xl shadow-md hover:scale-105 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-500 flex items-center gap-1 mt-2">
          <Calendar className="w-4 h-4" />
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </div>
      </Card>

      {/* Exercise list */}
      <div className="space-y-4">
        {groups.map((group, gi) => {
          const isSuper = group.length > 1;
          return (
            <div
              key={gi}
              className={`relative animate-fade-in rounded-2xl ${
                isSuper ? "border-l-4 border-amber-500 bg-amber-50/40 dark:bg-amber-900/10 pl-2" : ""
              }`}
            >
              {isSuper && (
                <div className="absolute -left-4 top-4 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-r-md shadow-sm flex items-center gap-1 z-10">
                  <LinkIcon className="w-3 h-3" /> Superset
                </div>
              )}
              <div className={`space-y-4 ${isSuper ? "py-2" : ""}`}>
                {group.map((exercise, ix) => {
                  const last = lastSessionFor(workouts, exercise.name);
                  // Plate calc target: next incomplete set, else the LAST set (so completing
                  // your final set doesn't snap the plates back to set 1).
                  const topSet =
                    exercise.sets.find((s) => !s.completed) ??
                    exercise.sets[exercise.sets.length - 1];
                  return (
                    <Card key={exercise.id} className="overflow-hidden relative">
                      <div className="p-5 pb-3 relative">
                        <ExerciseAutocomplete
                          value={exercise.name}
                          customExercises={customExercises}
                          onChange={(name) => {
                            const patch: Partial<Exercise> = { name };
                            if (!exercise.notes?.trim() && name.trim()) {
                              const pastNote = findPastNote(workouts, name);
                              if (pastNote) patch.notes = pastNote;
                            }
                            updateExercise(exercise.id, patch);
                          }}
                          onPick={(s) => {
                            // When picking a custom exercise, auto-fill its saved muscle tags.
                            if (s.muscles && s.muscles.length > 0 && !findExercise(s.name)) {
                              updateExercise(exercise.id, { muscles: s.muscles });
                            }
                          }}
                        />

                        {/* Muscle picker — only when the name isn't recognised by the library */}
                        {exercise.name.trim() && !findExercise(exercise.name) && (
                          <div className="mt-2">
                            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                              Custom exercise — tag muscles
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {(["chest","back","shoulders","biceps","triceps","forearms","core","quads","hamstrings","glutes","calves","cardio"] as MuscleGroup[]).map((m) => {
                                const selected = (exercise.muscles ?? []).includes(m);
                                return (
                                  <button
                                    key={m}
                                    type="button"
                                    onClick={() => {
                                      const cur = exercise.muscles ?? [];
                                      const next = selected ? cur.filter((x) => x !== m) : [...cur, m];
                                      updateExercise(exercise.id, { muscles: next });
                                    }}
                                    className={`text-[11px] font-semibold px-2 py-1 rounded-md transition-colors ${
                                      selected
                                        ? "bg-brand-500 text-white"
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                    }`}
                                  >
                                    {MUSCLE_LABELS[m]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Last-session hint (progressive overload) */}
                        {last && exercise.name && (
                          <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            Last time: <strong className="text-zinc-700 dark:text-zinc-300">{last.kg}kg × {last.reps}</strong>
                            <span className="text-emerald-600 dark:text-emerald-400">· try {Math.round(last.kg * 1.025)}kg</span>
                          </div>
                        )}

                        <div className="mt-3 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2 focus-within:bg-transparent focus-within:ring-2 focus-within:ring-brand-300 transition-all">
                          <MessageSquareQuote className="w-4 h-4 text-zinc-400 shrink-0" />
                          <input
                            placeholder="Notes (form cues, tempo)"
                            value={exercise.notes ?? ""}
                            onChange={(e) => updateExercise(exercise.id, { notes: e.target.value })}
                            maxLength={500}
                            className="bg-transparent text-sm w-full focus:outline-none text-zinc-700 dark:text-zinc-200"
                          />
                        </div>

                        <details className="mt-3 group">
                          <summary className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer flex items-center gap-1.5 select-none list-none [&::-webkit-details-marker]:hidden">
                            <Settings2 className="w-3 h-3" />
                            <span>Machine settings</span>
                            <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                          </summary>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <label className="flex flex-col gap-1 min-w-0">
                              <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500 font-bold">
                                Seat / pad
                              </span>
                              <input
                                value={exercise.settings?.seat ?? ""}
                                onChange={(e) =>
                                  updateExercise(exercise.id, {
                                    settings: { ...exercise.settings, seat: e.target.value },
                                  })
                                }
                                placeholder="e.g. 5"
                                maxLength={20}
                                className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-brand-500 outline-none placeholder-zinc-400 dark:placeholder-zinc-600"
                              />
                            </label>
                            <label className="flex flex-col gap-1 min-w-0">
                              <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500 font-bold">
                                Incline / angle
                              </span>
                              <input
                                value={exercise.settings?.incline ?? ""}
                                onChange={(e) =>
                                  updateExercise(exercise.id, {
                                    settings: { ...exercise.settings, incline: e.target.value },
                                  })
                                }
                                placeholder="e.g. 30°"
                                maxLength={20}
                                className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-brand-500 outline-none placeholder-zinc-400 dark:placeholder-zinc-600"
                              />
                            </label>
                          </div>
                        </details>

                        {topSet && topSet.kg > 0 && (
                          <div className="mt-3">
                            <PlateCalculator targetKg={topSet.kg} barbellKg={20} />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-[28px_1fr_1fr_auto] gap-2 px-4 py-2 bg-zinc-50/50 dark:bg-zinc-800/40 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider text-center border-y border-zinc-100 dark:border-zinc-800">
                        <div>#</div>
                        <div>{_units}</div>
                        <div>Reps</div>
                        <div className="w-[100px]"></div>
                      </div>

                      <div className="px-4 py-3 space-y-2">
                        {exercise.sets.map((set, idx) => (
                          <SetRow
                            key={set.id}
                            index={idx}
                            set={set}
                            suggestion={last ?? undefined}
                            canDelete={exercise.sets.length > 1}
                            onChange={(patch) => updateSet(exercise.id, set.id, patch)}
                            onDelete={() => removeSet(exercise.id, set.id)}
                            onComplete={() => {
                              if (timerEnabled) timer.start(exercise.restSec ?? 90);
                            }}
                          />
                        ))}
                      </div>

                      <button
                        onClick={() => addSet(exercise.id)}
                        className="w-full py-3 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-brand-600 dark:text-brand-400 font-semibold text-sm flex items-center justify-center gap-2 border-t border-zinc-100 dark:border-zinc-800 transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Add set
                      </button>

                      <div className="flex divide-x divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800">
                        {ix === 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => moveGroup(gi, -1)}
                              disabled={gi === 0}
                              aria-label="Move up"
                              className="flex-1 py-3 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-colors"
                            >
                              <ChevronUp className="w-4 h-4" /> Up
                            </button>
                            <button
                              type="button"
                              onClick={() => moveGroup(gi, 1)}
                              disabled={gi === groups.length - 1}
                              aria-label="Move down"
                              className="flex-1 py-3 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-colors"
                            >
                              <ChevronDown className="w-4 h-4" /> Down
                            </button>
                          </>
                        )}
                        {!isSuper && ix === 0 && (
                          <button
                            type="button"
                            onClick={() => addSuperset(exercise.id, exercise.supersetId ?? null)}
                            className="flex-1 py-3 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center justify-center gap-1 transition-colors"
                          >
                            <LinkIcon className="w-4 h-4" /> Superset
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeExercise(exercise.id)}
                          className="flex-1 py-3 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" /> Remove
                        </button>
                      </div>
                    </Card>
                  );
                })}
                {isSuper && (
                  <button
                    onClick={() => {
                      const last = group[group.length - 1]!;
                      addSuperset(last.id, last.supersetId);
                    }}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-amber-200 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center justify-center gap-2 font-semibold transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add to superset
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 pt-2">
        <Button onClick={addExercise} variant="secondary" size="lg" className="w-full">
          <Plus className="w-5 h-5" /> Add exercise
        </Button>
        <Button onClick={finish} loading={saving} size="lg" className="w-full bg-red-600 hover:bg-red-700">
          <Save className="w-5 h-5" /> Finish workout
        </Button>
        <Confirm
          title="Discard draft?"
          message="This clears all unsaved sets for this session."
          confirmLabel="Discard"
          destructive
          onConfirm={() => {
            clearDraft();
            timer.cancel();
            setDraft({ name: "Evening Lift", exercises: [blankExercise()], startedAt: Date.now() });
          }}
          trigger={(open) => (
            <button onClick={open} className="text-xs text-zinc-500 hover:text-red-500 mx-auto">
              Discard draft
            </button>
          )}
        />
      </div>


      <AIGenerateModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        recent={workouts}
        onApply={({ name, exercises }) => setDraft({ ...draft, name, exercises, startedAt: Date.now() })}
      />

      {/* Timer UI is page-scoped (only visible here). State lives globally in
          TimerProvider so it keeps ticking when you navigate away. */}
      <RestTimer />
    </div>
  );
}

function groupBySupersets(exercises: Exercise[]): Exercise[][] {
  const groups: Exercise[][] = [];
  let current: Exercise[] = [];
  exercises.forEach((ex, i) => {
    const prev = exercises[i - 1];
    if (i === 0) current.push(ex);
    else if (ex.supersetId && prev && prev.supersetId === ex.supersetId) current.push(ex);
    else {
      groups.push(current);
      current = [ex];
    }
  });
  if (current.length) groups.push(current);
  return groups;
}

/** Finds the most recent non-empty notes for an exercise name across past workouts. */
function findPastNote(workouts: { date: Date; exercises: Exercise[] }[], name: string): string | undefined {
  const target = name.trim().toLowerCase();
  if (!target) return undefined;
  const sorted = [...workouts].sort((a, b) => b.date.getTime() - a.date.getTime());
  for (const w of sorted) {
    for (const ex of w.exercises) {
      if (ex.name.trim().toLowerCase() === target && ex.notes?.trim()) {
        return ex.notes;
      }
    }
  }
  return undefined;
}
