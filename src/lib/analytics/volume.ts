import type { Workout, Exercise } from "@/types/workout";

/**
 * Tonnage for one exercise (Σ load × reps).
 *
 * Bodyweight movements (push-ups, pull-ups, dips) are logged at 0 kg, which would
 * otherwise contribute nothing. When a set has no external load we substitute
 * `bodyweightKg` (the lifter's latest logged bodyweight) so those reps count.
 * If no bodyweight is known yet we fall back to a load factor of 1 — i.e. the
 * reps themselves — so the work is never silently worth zero.
 */
export function exerciseVolume(ex: Exercise, bodyweightKg = 0): number {
  return (ex.sets ?? []).reduce((acc, s) => {
    const kg = Number.isFinite(s.kg) ? s.kg : 0;
    const reps = Number.isFinite(s.reps) ? s.reps : 0;
    const load = kg > 0 ? kg : bodyweightKg > 0 ? bodyweightKg : 1;
    return acc + load * reps;
  }, 0);
}

export function workoutVolume(w: Pick<Workout, "exercises">, bodyweightKg = 0): number {
  return (w.exercises ?? []).reduce((acc, ex) => acc + exerciseVolume(ex, bodyweightKg), 0);
}

export function workoutSetCount(w: Pick<Workout, "exercises">): number {
  return (w.exercises ?? []).reduce((acc, ex) => acc + (ex.sets?.length ?? 0), 0);
}
