/**
 * Turns a program's current day (per its cursor) into concrete, logger-ready
 * exercises — expanding percentage-of-training-max prescriptions into real kg,
 * rounded to the nearest loadable increment.
 */

import type { Exercise, WorkoutSet } from "@/types/workout";
import type { Program, ProgramCursor, ProgramDay, PrescribedSet } from "@/types/program";
import { uid } from "@/lib/utils";

/** Round a kg weight to the nearest 2.5 kg (smallest common total plate jump). */
function roundLoad(kg: number): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  return Math.round(kg / 2.5) * 2.5;
}

/** Parse a prescribed reps value (number | "5+" | "AMRAP" | "8-12") to a number. */
export function parseReps(reps: number | string): number {
  if (typeof reps === "number") return Number.isFinite(reps) ? reps : 0;
  const m = String(reps).match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

/** Resolve a single prescribed set to a concrete logged-set shape (uncompleted). */
function resolveSet(p: PrescribedSet, tm: number | undefined): WorkoutSet {
  let kg = 0;
  if (p.loadType === "fixed") kg = p.kg ?? 0;
  else if (p.loadType === "pctTM") kg = roundLoad((tm ?? 0) * (p.pctTM ?? 0));
  // "rpe" and "bodyweight" leave kg at 0 for the user to fill in.
  return {
    id: uid(),
    kg,
    reps: parseReps(p.reps),
    rpe: p.rpe,
    completed: false,
  };
}

/** Human label for a prescription, e.g. "3 × 5+ @ 85%" — shown in notes. */
function prescriptionLabel(prescribed: PrescribedSet[]): string {
  if (prescribed.length === 0) return "";
  // Group identical consecutive prescriptions for a compact label.
  const parts: string[] = [];
  let i = 0;
  while (i < prescribed.length) {
    const p = prescribed[i]!;
    let j = i + 1;
    while (j < prescribed.length && samePrescription(p, prescribed[j]!)) j++;
    const count = j - i;
    const load =
      p.loadType === "pctTM"
        ? ` @ ${Math.round((p.pctTM ?? 0) * 100)}%`
        : p.loadType === "rpe" && p.rpe
          ? ` @ RPE ${p.rpe}`
          : "";
    parts.push(`${count} × ${p.reps}${load}`);
    i = j;
  }
  return parts.join(", ");
}

function samePrescription(a: PrescribedSet, b: PrescribedSet): boolean {
  return (
    a.loadType === b.loadType &&
    a.reps === b.reps &&
    a.kg === b.kg &&
    a.pctTM === b.pctTM &&
    a.rpe === b.rpe
  );
}

export interface ResolvedDay {
  name: string;
  exercises: Exercise[];
  /** Safe day, even if cursor was out of range (clamped). */
  cursor: ProgramCursor;
}

/** Clamp a cursor into a program's actual bounds. */
export function clampCursor(program: Program, cursor: ProgramCursor): ProgramCursor {
  const week = Math.min(Math.max(cursor.week, 0), Math.max(program.weeks.length - 1, 0));
  const days = program.weeks[week]?.days ?? [];
  const day = Math.min(Math.max(cursor.day, 0), Math.max(days.length - 1, 0));
  return { week, day };
}

/** The day a cursor points at (clamped), or null if the program is empty. */
export function dayAt(program: Program, cursor: ProgramCursor): ProgramDay | null {
  const c = clampCursor(program, cursor);
  return program.weeks[c.week]?.days[c.day] ?? null;
}

/** Resolve the program's current cursor day into logger-ready exercises. */
export function resolveDay(program: Program, cursor = program.cursor): ResolvedDay | null {
  const c = clampCursor(program, cursor);
  const day = dayAt(program, c);
  if (!day) return null;

  const weekLabel = program.weeks[c.week]?.label ?? `Week ${c.week + 1}`;
  const tms = program.trainingMaxes ?? {};

  const exercises: Exercise[] = day.exercises.map((ex) => {
    const label = prescriptionLabel(ex.prescribed);
    const note = [ex.notes?.trim(), label && `Target: ${label}`].filter(Boolean).join(" · ");
    return {
      id: uid(),
      name: ex.name,
      notes: note || undefined,
      restSec: ex.restSec ?? 90,
      muscles: ex.muscles,
      sets: ex.prescribed.map((p) => resolveSet(p, tms[ex.name])),
    };
  });

  return {
    name: `${program.name} — ${day.label} (${weekLabel})`,
    exercises,
    cursor: c,
  };
}

/** Advance a cursor to the next day, rolling into the next week and looping at the end. */
export function nextCursor(program: Program, cursor: ProgramCursor): ProgramCursor {
  const c = clampCursor(program, cursor);
  const week = program.weeks[c.week];
  const dayCount = week?.days.length ?? 0;
  if (c.day + 1 < dayCount) return { week: c.week, day: c.day + 1 };
  // Move to next week, looping back to the start after the final week.
  const nextWeek = (c.week + 1) % Math.max(program.weeks.length, 1);
  return { week: nextWeek, day: 0 };
}

/** Whether a program has at least one usable training day. */
export function hasDays(program: Program): boolean {
  return program.weeks.some((w) => w.days.length > 0);
}

/** Canonical names of exercises that need a training max (pctTM) but lack one. */
export function missingTrainingMaxes(program: Program): string[] {
  const tms = program.trainingMaxes ?? {};
  const needed = new Set<string>();
  for (const w of program.weeks) {
    for (const d of w.days) {
      for (const ex of d.exercises) {
        if (ex.prescribed.some((p) => p.loadType === "pctTM")) {
          if (!((tms[ex.name] ?? 0) > 0)) needed.add(ex.name);
        }
      }
    }
  }
  return [...needed];
}
