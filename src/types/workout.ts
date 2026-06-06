export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "core"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "cardio";

export interface ExerciseDefinition {
  /** Canonical name (e.g. "Bench Press") */
  name: string;
  /** Lowercase aliases for search */
  aliases: string[];
  /** Primary muscle groups worked */
  primary: MuscleGroup[];
  /** Secondary muscle groups worked */
  secondary?: MuscleGroup[];
  /** "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" */
  equipment: "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "kettlebell" | "other";
}

export interface WorkoutSet {
  id: string;
  kg: number;
  reps: number;
  /** Rate of Perceived Exertion, 1-10 (optional) */
  rpe?: number;
  completed: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  notes?: string;
  /** For superset grouping. Exercises sharing a supersetId are performed back-to-back. */
  supersetId?: string | null;
  /** Optional machine settings */
  settings?: { seat?: string; incline?: string };
  /** Default rest time in seconds for this exercise */
  restSec?: number;
  /** Muscle group tags for CUSTOM exercises (those not in the curated library).
   *  Used by the dashboard muscle balance when no library match is found. */
  muscles?: MuscleGroup[];
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  name: string;
  date: Date;
  exercises: Exercise[];
  /** Total volume in kg (computed). */
  totalVolume: number;
  /** Total duration in seconds (optional) */
  durationSec?: number;
  notes?: string;
  /** Set when this session was started from a program day (mesocycle tracking). */
  programRef?: import("./program").ProgramRef;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: Omit<Exercise, "id" | "sets">[] & {
    /** Template exercises just hold prescribed sets */
    prescribed?: { sets: number; reps: number | string; rpe?: number }[];
  };
  createdAt: Date;
}

export interface BodyMetric {
  id: string;
  date: Date;
  weightKg?: number;
  bodyFatPct?: number;
  measurements?: Partial<Record<"chest" | "waist" | "hips" | "arms" | "thighs" | "neck", number>>;
  notes?: string;
}
