"use client";

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./client";
import type { Workout, WorkoutTemplate, BodyMetric, MuscleGroup } from "@/types/workout";
import type { CoachMessage } from "@/types/ai";
import type { UserProfile } from "@/types/user";
import type { Program, ProgramCursor } from "@/types/program";

// ─── Workouts ────────────────────────────────────────────────────────
function workoutsCol(uid: string) {
  return collection(db, "users", uid, "workouts");
}

export function subscribeToWorkouts(uid: string, cb: (workouts: Workout[]) => void): Unsubscribe {
  const q = query(workoutsCol(uid), orderBy("date", "desc"));
  return onSnapshot(q, (snap) => {
    const rows: Workout[] = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      const ts = data["date"];
      const date = ts instanceof Timestamp ? ts.toDate() : new Date();
      return {
        id: d.id,
        name: String(data["name"] ?? "Untitled"),
        date,
        exercises: (data["exercises"] as Workout["exercises"]) ?? [],
        totalVolume: Number(data["totalVolume"] ?? 0),
        durationSec: data["durationSec"] as number | undefined,
        notes: data["notes"] as string | undefined,
        programRef: (data["programRef"] as Workout["programRef"]) ?? undefined,
      };
    });
    cb(rows);
  });
}

export async function saveWorkout(uid: string, workout: Omit<Workout, "id" | "date"> & { date?: Date }) {
  return addDoc(workoutsCol(uid), {
    name: workout.name,
    exercises: workout.exercises,
    totalVolume: workout.totalVolume,
    durationSec: workout.durationSec ?? null,
    notes: workout.notes ?? null,
    programRef: workout.programRef ?? null,
    date: workout.date ? Timestamp.fromDate(workout.date) : serverTimestamp(),
  });
}

export async function deleteWorkout(uid: string, workoutId: string) {
  return deleteDoc(doc(db, "users", uid, "workouts", workoutId));
}

// ─── Custom exercises (user's personal library) ──────────────────────
export interface CustomExercise {
  /** Slug of the exercise name (used as doc id). */
  id: string;
  name: string;
  muscles: MuscleGroup[];
  createdAt: Date;
}

function customExercisesCol(uid: string) {
  return collection(db, "users", uid, "exercises");
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function subscribeToCustomExercises(uid: string, cb: (exs: CustomExercise[]) => void): Unsubscribe {
  return onSnapshot(customExercisesCol(uid), (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: String(data["name"] ?? d.id),
          muscles: (data["muscles"] as MuscleGroup[]) ?? [],
          createdAt: data["createdAt"] instanceof Timestamp ? (data["createdAt"] as Timestamp).toDate() : new Date(),
        };
      }),
    );
  });
}

/** Idempotent: upserts a custom exercise. Safe to call on every workout finish. */
export async function upsertCustomExercise(uid: string, name: string, muscles: MuscleGroup[]) {
  const id = slugify(name);
  if (!id) return;
  const ref = doc(customExercisesCol(uid), id);
  await setDoc(
    ref,
    {
      name: name.trim(),
      muscles,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteCustomExercise(uid: string, id: string) {
  return deleteDoc(doc(customExercisesCol(uid), id));
}

// ─── Templates ───────────────────────────────────────────────────────
export function templatesCol(uid: string) {
  return collection(db, "users", uid, "templates");
}

export function subscribeToTemplates(uid: string, cb: (t: WorkoutTemplate[]) => void): Unsubscribe {
  const q = query(templatesCol(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: String(data["name"] ?? "Untitled"),
          exercises: (data["exercises"] as WorkoutTemplate["exercises"]) ?? [],
          createdAt: data["createdAt"] instanceof Timestamp ? (data["createdAt"] as Timestamp).toDate() : new Date(),
        };
      }),
    );
  });
}

export async function saveTemplate(uid: string, template: Omit<WorkoutTemplate, "id" | "createdAt">) {
  return addDoc(templatesCol(uid), {
    name: template.name,
    exercises: template.exercises,
    createdAt: serverTimestamp(),
  });
}

export async function deleteTemplate(uid: string, id: string) {
  return deleteDoc(doc(db, "users", uid, "templates", id));
}

// ─── Body metrics ────────────────────────────────────────────────────
export function bodyMetricsCol(uid: string) {
  return collection(db, "users", uid, "bodyMetrics");
}

export function subscribeToBodyMetrics(uid: string, cb: (m: BodyMetric[]) => void): Unsubscribe {
  const q = query(bodyMetricsCol(uid), orderBy("date", "desc"));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const ts = data["date"];
        return {
          id: d.id,
          date: ts instanceof Timestamp ? ts.toDate() : new Date(),
          weightKg: data["weightKg"] as number | undefined,
          bodyFatPct: data["bodyFatPct"] as number | undefined,
          measurements: data["measurements"] as BodyMetric["measurements"],
          notes: data["notes"] as string | undefined,
        };
      }),
    ),
  );
}

export async function addBodyMetric(uid: string, metric: Omit<BodyMetric, "id">) {
  return addDoc(bodyMetricsCol(uid), {
    ...metric,
    date: Timestamp.fromDate(metric.date),
  });
}

// ─── Coach chat ──────────────────────────────────────────────────────
export function coachCol(uid: string) {
  return collection(db, "users", uid, "coachChats");
}

export function subscribeToCoachMessages(uid: string, cb: (msgs: CoachMessage[]) => void): Unsubscribe {
  const q = query(coachCol(uid), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const ts = data["createdAt"];
        return {
          id: d.id,
          role: (data["role"] as "user" | "model") ?? "model",
          text: String(data["text"] ?? ""),
          createdAt: ts instanceof Timestamp ? ts.toDate() : new Date(),
        };
      }),
    ),
  );
}

export async function appendCoachMessage(uid: string, role: "user" | "model", text: string) {
  return addDoc(coachCol(uid), { role, text, createdAt: serverTimestamp() });
}

// ─── User profile (units, theme, weekly goal) ────────────────────────
export function profileDoc(uid: string) {
  return doc(db, "users", uid);
}

export async function upsertProfile(uid: string, patch: Partial<UserProfile>) {
  return setDoc(profileDoc(uid), patch, { merge: true });
}

export function subscribeToProfile(uid: string, cb: (p: Partial<UserProfile> | null) => void): Unsubscribe {
  return onSnapshot(profileDoc(uid), (snap) => {
    cb(snap.exists() ? (snap.data() as Partial<UserProfile>) : null);
  });
}

// ─── Programs / mesocycles ───────────────────────────────────────────
export function programsCol(uid: string) {
  return collection(db, "users", uid, "programs");
}

export function subscribeToPrograms(uid: string, cb: (p: Program[]) => void): Unsubscribe {
  const q = query(programsCol(uid), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: String(data["name"] ?? "Untitled program"),
          description: data["description"] as string | undefined,
          weeks: (data["weeks"] as Program["weeks"]) ?? [],
          trainingMaxes: (data["trainingMaxes"] as Program["trainingMaxes"]) ?? {},
          active: Boolean(data["active"]),
          cursor: (data["cursor"] as ProgramCursor) ?? { week: 0, day: 0 },
          createdAt: data["createdAt"] instanceof Timestamp ? (data["createdAt"] as Timestamp).toDate() : new Date(),
        };
      }),
    ),
  );
}

export async function saveProgram(
  uid: string,
  program: Omit<Program, "id" | "createdAt">,
) {
  return addDoc(programsCol(uid), {
    name: program.name,
    description: program.description ?? null,
    weeks: program.weeks,
    trainingMaxes: program.trainingMaxes ?? {},
    active: program.active ?? false,
    cursor: program.cursor ?? { week: 0, day: 0 },
    createdAt: serverTimestamp(),
  });
}

export async function updateProgram(uid: string, id: string, patch: Partial<Program>) {
  return updateDoc(doc(programsCol(uid), id), patch as Record<string, unknown>);
}

export async function deleteProgram(uid: string, id: string) {
  return deleteDoc(doc(programsCol(uid), id));
}

/** Make exactly one program active; all others are flipped inactive in a batch. */
export async function setActiveProgram(uid: string, id: string, allIds: string[]) {
  const batch = writeBatch(db);
  for (const pid of allIds) {
    batch.update(doc(programsCol(uid), pid), { active: pid === id });
  }
  return batch.commit();
}

export async function advanceProgramCursor(uid: string, id: string, cursor: ProgramCursor) {
  return updateDoc(doc(programsCol(uid), id), { cursor });
}
