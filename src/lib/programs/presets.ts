/**
 * Built-in program templates. Each `build()` returns fresh weeks (with new day
 * ids) so installing the same preset twice yields independent programs.
 *
 * Percentage-based programs (5/3/1, nSuns) reference a training max per lift;
 * the user sets those after installing.
 */

import type { ProgramWeek, PrescribedSet, ProgramExercise } from "@/types/program";
import { uid } from "@/lib/utils";

export interface PresetProgram {
  key: string;
  name: string;
  description: string;
  /** Lifts (canonical names) the user must set a training max for. */
  trainingMaxLifts: string[];
  build: () => ProgramWeek[];
}

// ── helpers ──────────────────────────────────────────────────────────
function day(label: string, exercises: ProgramExercise[]) {
  return { id: uid(), label, exercises };
}

/** N identical sets at a fixed RPE target (weight entered by the user). */
function rpeSets(sets: number, reps: number | string, rpe?: number): PrescribedSet[] {
  return Array.from({ length: sets }, () => ({ reps, loadType: "rpe" as const, rpe }));
}

function bwSets(sets: number, reps: number | string): PrescribedSet[] {
  return Array.from({ length: sets }, () => ({ reps, loadType: "bodyweight" as const }));
}

function pct(reps: number | string, p: number, rpe?: number): PrescribedSet {
  return { reps, loadType: "pctTM", pctTM: p, rpe };
}

// ── Push / Pull / Legs (6-day) ───────────────────────────────────────
function pplWeek(): ProgramWeek[] {
  const push = (variant: "A" | "B") =>
    day(`Push ${variant}`, [
      { name: variant === "A" ? "Barbell Bench Press" : "Overhead Press", prescribed: rpeSets(4, 6, 8), restSec: 150 },
      { name: variant === "A" ? "Overhead Press" : "Incline Bench Press", prescribed: rpeSets(3, 8, 8), restSec: 120 },
      { name: "Incline Dumbbell Press", prescribed: rpeSets(3, 10, 9), restSec: 90 },
      { name: "Lateral Raise", prescribed: rpeSets(3, 15, 9), restSec: 60 },
      { name: "Tricep Pushdown", prescribed: rpeSets(3, 12, 9), restSec: 60 },
    ]);
  const pull = (variant: "A" | "B") =>
    day(`Pull ${variant}`, [
      { name: variant === "A" ? "Deadlift" : "Barbell Row", prescribed: rpeSets(variant === "A" ? 2 : 4, variant === "A" ? 5 : 8, 8), restSec: 180 },
      { name: "Pull Up", prescribed: bwSets(3, 8), restSec: 120 },
      { name: "Seated Cable Row", prescribed: rpeSets(3, 10, 9), restSec: 90 },
      { name: "Face Pull", prescribed: rpeSets(3, 15, 9), restSec: 60 },
      { name: "Barbell Curl", prescribed: rpeSets(3, 12, 9), restSec: 60 },
    ]);
  const legs = (variant: "A" | "B") =>
    day(`Legs ${variant}`, [
      { name: variant === "A" ? "Back Squat" : "Romanian Deadlift", prescribed: rpeSets(4, variant === "A" ? 6 : 8, 8), restSec: 180 },
      { name: variant === "A" ? "Romanian Deadlift" : "Leg Press", prescribed: rpeSets(3, 10, 8), restSec: 120 },
      { name: "Leg Extension", prescribed: rpeSets(3, 12, 9), restSec: 75 },
      { name: "Leg Curl", prescribed: rpeSets(3, 12, 9), restSec: 75 },
      { name: "Standing Calf Raise", prescribed: rpeSets(4, 15, 9), restSec: 60 },
    ]);
  return [
    {
      label: "Week 1",
      days: [push("A"), pull("A"), legs("A"), push("B"), pull("B"), legs("B")],
    },
  ];
}

// ── 5/3/1 (4-day, classic + light accessories) ───────────────────────
function fiveThreeOne(): ProgramWeek[] {
  // main-lift percentage schemes per week
  const schemes: Record<string, PrescribedSet[]> = {
    "5s": [pct(5, 0.65), pct(5, 0.75), pct("5+", 0.85)],
    "3s": [pct(3, 0.7), pct(3, 0.8), pct("3+", 0.9)],
    "531": [pct(5, 0.75), pct(3, 0.85), pct("1+", 0.95)],
    deload: [pct(5, 0.4), pct(5, 0.5), pct(5, 0.6)],
  };

  const mainDay = (label: string, lift: string, scheme: keyof typeof schemes, accessories: ProgramExercise[]) =>
    day(label, [{ name: lift, prescribed: schemes[scheme]!, restSec: 180 }, ...accessories]);

  const week = (label: string, scheme: keyof typeof schemes): ProgramWeek => ({
    label,
    days: [
      mainDay("Press", "Overhead Press", scheme, [
        { name: "Dip", prescribed: bwSets(5, 10), restSec: 90 },
        { name: "Chin Up", prescribed: bwSets(5, 8), restSec: 90 },
      ]),
      mainDay("Deadlift", "Deadlift", scheme, [
        { name: "Romanian Deadlift", prescribed: rpeSets(4, 8, 8), restSec: 120 },
        { name: "Hanging Leg Raise", prescribed: bwSets(4, 12), restSec: 60 },
      ]),
      mainDay("Bench", "Barbell Bench Press", scheme, [
        { name: "Dumbbell Bench Press", prescribed: rpeSets(5, 10, 8), restSec: 90 },
        { name: "Barbell Row", prescribed: rpeSets(5, 10, 8), restSec: 90 },
      ]),
      mainDay("Squat", "Back Squat", scheme, [
        { name: "Leg Press", prescribed: rpeSets(4, 12, 8), restSec: 120 },
        { name: "Leg Curl", prescribed: rpeSets(4, 12, 9), restSec: 75 },
      ]),
    ],
  });

  return [week("Week 1 — 5s", "5s"), week("Week 2 — 3s", "3s"), week("Week 3 — 5/3/1", "531"), week("Week 4 — Deload", "deload")];
}

// ── nSuns 5/3/1 LP (4-day, T1 main + T2) ─────────────────────────────
function nSuns(): ProgramWeek[] {
  // Canonical nSuns T1 nine-set scheme (percent of training max).
  const t1: PrescribedSet[] = [
    pct(5, 0.65), pct(3, 0.75), pct("1+", 0.85), pct(3, 0.85), pct(3, 0.8),
    pct(3, 0.75), pct(5, 0.7), pct(5, 0.65), pct("5+", 0.6),
  ];
  // T2 eight-set scheme (lighter, volume).
  const t2: PrescribedSet[] = [
    pct(6, 0.5), pct(5, 0.6), pct(3, 0.7), pct(5, 0.7), pct(7, 0.7),
    pct(4, 0.7), pct(6, 0.65), pct("8+", 0.6),
  ];
  const acc = (name: string) => ({ name, prescribed: rpeSets(3, 12, 9), restSec: 75 });

  return [
    {
      label: "Week 1 (bump TMs each cycle)",
      days: [
        day("Bench / OHP", [
          { name: "Barbell Bench Press", prescribed: t1, restSec: 180 },
          { name: "Overhead Press", prescribed: t2, restSec: 120 },
          acc("Tricep Pushdown"),
          acc("Lateral Raise"),
        ]),
        day("Squat / Sumo Deadlift", [
          { name: "Back Squat", prescribed: t1, restSec: 180 },
          { name: "Deadlift", prescribed: t2, restSec: 150 },
          acc("Leg Curl"),
          acc("Standing Calf Raise"),
        ]),
        day("OHP / Incline Bench", [
          { name: "Overhead Press", prescribed: t1, restSec: 180 },
          { name: "Incline Bench Press", prescribed: t2, restSec: 120 },
          acc("Lat Pulldown"),
          acc("Hammer Curl"),
        ]),
        day("Deadlift / Front Squat", [
          { name: "Deadlift", prescribed: t1, restSec: 180 },
          { name: "Front Squat", prescribed: t2, restSec: 150 },
          acc("Seated Cable Row"),
          acc("Hanging Leg Raise"),
        ]),
      ],
    },
  ];
}

export const PRESET_PROGRAMS: PresetProgram[] = [
  {
    key: "ppl6",
    name: "Push Pull Legs (6-day)",
    description: "Classic 6-day PPL hypertrophy split. Enter your own weights at an RPE target; loops weekly.",
    trainingMaxLifts: [],
    build: pplWeek,
  },
  {
    key: "531",
    name: "5/3/1 (4-day)",
    description: "Wendler 5/3/1 — 4 weeks (5s, 3s, 5/3/1, deload) on percentages of your training max. Bump TMs after each cycle.",
    trainingMaxLifts: ["Overhead Press", "Deadlift", "Barbell Bench Press", "Back Squat"],
    build: fiveThreeOne,
  },
  {
    key: "nsuns",
    name: "nSuns 5/3/1 LP (4-day)",
    description: "High-volume linear progression. T1 nine-set main lift + T2 volume work on percentages. Raise TMs each week.",
    trainingMaxLifts: ["Barbell Bench Press", "Back Squat", "Overhead Press", "Deadlift"],
    build: nSuns,
  },
];

export function findPreset(key: string): PresetProgram | undefined {
  return PRESET_PROGRAMS.find((p) => p.key === key);
}
