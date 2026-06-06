/**
 * Multi-week, multi-day training programs (mesocycles).
 *
 * A Program is an ordered list of weeks; each week is an ordered list of days;
 * each day prescribes exercises with target sets. Unlike a logged Workout, a
 * program holds *prescriptions* (what to do), not results (what you did).
 *
 * The active program carries a cursor — the (week, day) the user is up to. That
 * cursor is the "today's workout" pointer surfaced on the dashboard. It only
 * advances when a session derived from the program is actually completed, so
 * skipped days never desync the schedule.
 */

import type { MuscleGroup } from "./workout";

/** How the working weight for a prescribed set is determined. */
export type LoadType =
  | "fixed" // explicit kg
  | "pctTM" // percentage of the exercise's training max (5/3/1, nSuns)
  | "rpe" // user picks weight to hit a target RPE
  | "bodyweight"; // no external load

export interface PrescribedSet {
  /** Target reps. Number, or a string like "5+", "AMRAP", "8-12". */
  reps: number | string;
  loadType: LoadType;
  /** Explicit working weight in kg (loadType === "fixed"). */
  kg?: number;
  /** Fraction of training max, e.g. 0.85 (loadType === "pctTM"). */
  pctTM?: number;
  /** Target RPE (loadType === "rpe"), or a hint for pctTM AMRAP sets. */
  rpe?: number;
}

export interface ProgramExercise {
  /** Prefer canonical library names so analytics / autocomplete line up. */
  name: string;
  notes?: string;
  restSec?: number;
  prescribed: PrescribedSet[];
  /** Muscle tags for custom (non-library) exercises. */
  muscles?: MuscleGroup[];
}

export interface ProgramDay {
  id: string;
  /** e.g. "Push A", "Day 1 — Squat". */
  label: string;
  exercises: ProgramExercise[];
}

export interface ProgramWeek {
  /** e.g. "Week 1 — 5s", "Deload". Optional; defaults to "Week N". */
  label?: string;
  days: ProgramDay[];
}

/** Pointer into a program: which week / day the user is up to. */
export interface ProgramCursor {
  week: number; // 0-based index into weeks
  day: number; // 0-based index into the week's days
}

export interface Program {
  id: string;
  name: string;
  /** Optional longer description (e.g. "4-day 5/3/1 with BBB"). */
  description?: string;
  weeks: ProgramWeek[];
  /**
   * Training maxes keyed by canonical exercise name, in kg. Required for
   * programs that use pctTM sets. e.g. { "Back Squat": 140, "Deadlift": 180 }.
   */
  trainingMaxes?: Record<string, number>;
  /** Exactly one program per user should be active at a time. */
  active: boolean;
  /** Where the user is up to. Defaults to { week: 0, day: 0 }. */
  cursor: ProgramCursor;
  createdAt: Date;
}

/** Stamped onto a logged Workout when it was started from a program day. */
export interface ProgramRef {
  id: string;
  programName: string;
  week: number;
  day: number;
  dayLabel: string;
}
