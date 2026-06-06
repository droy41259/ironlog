"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check, ChevronDown, Plus, Trash2, Dumbbell, Play, Star, Pencil, X,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useUnits } from "@/providers/UnitsProvider";
import { useToast } from "@/providers/ToastProvider";
import { usePrograms } from "@/hooks/usePrograms";
import {
  saveProgram, updateProgram, deleteProgram, setActiveProgram, advanceProgramCursor,
} from "@/lib/firebase/repository";
import { PRESET_PROGRAMS } from "@/lib/programs/presets";
import { clampCursor, missingTrainingMaxes } from "@/lib/programs/resolve";
import { fromKg, toKg } from "@/lib/units/converter";
import { uid } from "@/lib/utils";
import type { Program } from "@/types/program";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";

export default function ProgramsPage() {
  const { user } = useAuth();
  const { units } = useUnits();
  const { programs, active, loading } = usePrograms();
  const toast = useToast();
  const router = useRouter();
  const [installing, setInstalling] = useState<string | null>(null);

  const allIds = useMemo(() => programs.map((p) => p.id), [programs]);

  const install = async (key: string) => {
    if (!user) return;
    const preset = PRESET_PROGRAMS.find((p) => p.key === key);
    if (!preset) return;
    setInstalling(key);
    try {
      const trainingMaxes: Record<string, number> = {};
      preset.trainingMaxLifts.forEach((l) => (trainingMaxes[l] = 0));
      await saveProgram(user.uid, {
        name: preset.name,
        description: preset.description,
        weeks: preset.build(),
        trainingMaxes,
        active: programs.length === 0, // first program installed becomes active
        cursor: { week: 0, day: 0 },
      });
      toast.success(`${preset.name} added`);
    } catch {
      toast.error("Couldn't add program.");
    } finally {
      setInstalling(null);
    }
  };

  const makeActive = async (p: Program) => {
    if (!user) return;
    try {
      await setActiveProgram(user.uid, p.id, allIds);
      toast.success(`${p.name} is now active`);
    } catch {
      toast.error("Couldn't activate.");
    }
  };

  const remove = async (p: Program) => {
    if (!user) return;
    try {
      await deleteProgram(user.uid, p.id);
      toast.success("Program deleted");
    } catch {
      toast.error("Couldn't delete.");
    }
  };

  const createBlank = async () => {
    if (!user) return;
    try {
      await saveProgram(user.uid, {
        name: "My Program",
        description: "",
        weeks: [{ label: "Week 1", days: [{ id: uid(), label: "Day 1", exercises: [] }] }],
        trainingMaxes: {},
        active: programs.length === 0,
        cursor: { week: 0, day: 0 },
      });
      toast.success("Blank program created — edit it below");
    } catch {
      toast.error("Couldn't create program.");
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pb-28">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Programs</h1>
        <Button size="sm" variant="outline" onClick={createBlank}>
          <Plus className="w-4 h-4" /> Blank
        </Button>
      </div>

      {/* Installed programs */}
      {loading ? (
        <Card className="p-5 text-sm text-zinc-500">Loading…</Card>
      ) : programs.length === 0 ? (
        <Card className="p-5 text-sm text-zinc-500">
          No programs yet. Install a template below or create a blank one.
        </Card>
      ) : (
        <div className="space-y-3">
          {programs.map((p) => (
            <ProgramRow
              key={p.id}
              program={p}
              units={units}
              isActive={active?.id === p.id}
              onActivate={() => makeActive(p)}
              onDelete={() => remove(p)}
              onStart={() => router.push(`/log?program=${p.id}`)}
              onSaveTM={async (name, kg) => {
                if (!user) return;
                await updateProgram(user.uid, p.id, {
                  trainingMaxes: { ...(p.trainingMaxes ?? {}), [name]: kg },
                });
              }}
              onJump={async (week, day) => {
                if (!user) return;
                await advanceProgramCursor(user.uid, p.id, { week, day });
                toast.success("Marked as next up");
              }}
              onRename={async (name) => {
                if (!user || !name.trim()) return;
                await updateProgram(user.uid, p.id, { name: name.trim() });
              }}
            />
          ))}
        </div>
      )}

      {/* Preset library */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-2">Templates</h2>
        <div className="space-y-3">
          {PRESET_PROGRAMS.map((preset) => (
            <Card key={preset.key} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-zinc-900 dark:text-white">{preset.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1">{preset.description}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => install(preset.key)}
                  loading={installing === preset.key}
                  className="shrink-0"
                >
                  <Plus className="w-4 h-4" /> Add
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Single program card ──────────────────────────────────────────────
function ProgramRow({
  program, units, isActive, onActivate, onDelete, onStart, onSaveTM, onJump, onRename,
}: {
  program: Program;
  units: "kg" | "lb";
  isActive: boolean;
  onActivate: () => void;
  onDelete: () => void;
  onStart: () => void;
  onSaveTM: (name: string, kg: number) => Promise<void>;
  onJump: (week: number, day: number) => Promise<void>;
  onRename: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(isActive);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(program.name);
  const cursor = clampCursor(program, program.cursor);
  const needsTM = missingTrainingMaxes(program);
  const tmLifts = Object.keys(program.trainingMaxes ?? {});

  return (
    <Card className={isActive ? "border-brand-400 dark:border-brand-500" : ""}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <button onClick={() => setOpen((o) => !o)} className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              {isActive && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                  <Star className="w-3 h-3" fill="currentColor" /> Active
                </span>
              )}
            </div>
            {editingName ? (
              <span className="flex items-center gap-1.5 mt-0.5" onClick={(e) => e.stopPropagation()}>
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  maxLength={60}
                  className="text-lg font-bold bg-transparent border-b border-brand-400 focus:outline-none text-zinc-900 dark:text-white"
                />
                <button onClick={async () => { await onRename(nameDraft); setEditingName(false); }} aria-label="Save name">
                  <Check className="w-4 h-4 text-brand-500" />
                </button>
                <button onClick={() => { setNameDraft(program.name); setEditingName(false); }} aria-label="Cancel">
                  <X className="w-4 h-4 text-zinc-400" />
                </button>
              </span>
            ) : (
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white truncate flex items-center gap-1.5">
                {program.name}
                <Pencil
                  className="w-3.5 h-3.5 text-zinc-400 shrink-0"
                  onClick={(e) => { e.stopPropagation(); setEditingName(true); }}
                />
              </h3>
            )}
            <p className="text-xs text-zinc-500">
              {program.weeks.length} week{program.weeks.length !== 1 && "s"} ·{" "}
              {program.weeks.reduce((n, w) => n + w.days.length, 0)} days · up to{" "}
              {program.weeks[cursor.week]?.label ?? `Week ${cursor.week + 1}`} /{" "}
              {program.weeks[cursor.week]?.days[cursor.day]?.label ?? "—"}
            </p>
          </button>
          <ChevronDown
            className={`w-5 h-5 text-zinc-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
            onClick={() => setOpen((o) => !o)}
          />
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {!isActive && (
            <Button size="sm" variant="secondary" onClick={onActivate}>
              <Star className="w-4 h-4" /> Set active
            </Button>
          )}
          {isActive && (
            <Button size="sm" onClick={onStart}>
              <Play className="w-4 h-4" fill="currentColor" /> Start today
            </Button>
          )}
          <Confirm
            title="Delete program?"
            message={`"${program.name}" will be removed. Your logged workouts stay.`}
            confirmLabel="Delete"
            destructive
            onConfirm={onDelete}
            trigger={(openConfirm) => (
              <Button size="sm" variant="ghost" onClick={openConfirm} className="text-red-500">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          />
        </div>
      </div>

      {open && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 p-4 space-y-4">
          {/* Training maxes */}
          {tmLifts.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                Training maxes ({units})
              </p>
              {needsTM.length > 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2">
                  Set a value for every lift so percentages compute correctly.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {tmLifts.map((lift) => (
                  <TMInput
                    key={lift}
                    lift={lift}
                    units={units}
                    kg={program.trainingMaxes?.[lift] ?? 0}
                    onSave={(kg) => onSaveTM(lift, kg)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Week / day breakdown */}
          {program.weeks.map((week, wi) => (
            <div key={wi}>
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {week.label ?? `Week ${wi + 1}`}
              </p>
              <div className="space-y-1.5">
                {week.days.map((d, di) => {
                  const upNext = cursor.week === wi && cursor.day === di;
                  return (
                    <div
                      key={d.id}
                      className={`rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                        upNext
                          ? "bg-brand-50 dark:bg-brand-900/20 border border-brand-300 dark:border-brand-700"
                          : "bg-zinc-50 dark:bg-zinc-800/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{d.label}</span>
                        <span className="block text-xs text-zinc-500 truncate flex items-center gap-1">
                          <Dumbbell className="w-3 h-3 shrink-0" />
                          {d.exercises.map((e) => e.name).join(", ") || "No exercises"}
                        </span>
                      </div>
                      {upNext ? (
                        <span className="text-[10px] font-bold uppercase text-brand-600 dark:text-brand-400 shrink-0">
                          Up next
                        </span>
                      ) : (
                        <button
                          onClick={() => onJump(wi, di)}
                          className="text-[11px] text-zinc-400 hover:text-brand-500 shrink-0"
                        >
                          Set next
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Training-max input (debounced save on blur) ──────────────────────
function TMInput({
  lift, units, kg, onSave,
}: {
  lift: string;
  units: "kg" | "lb";
  kg: number;
  onSave: (kg: number) => void;
}) {
  const display = kg > 0 ? String(Math.round(fromKg(kg, units))) : "";
  const [val, setVal] = useState(display);

  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 truncate">{lift}</span>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/[^0-9.]/g, ""))}
        onBlur={() => {
          const n = parseFloat(val);
          onSave(Number.isFinite(n) && n > 0 ? toKg(n, units) : 0);
        }}
        inputMode="decimal"
        placeholder="0"
        className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-brand-500 outline-none"
      />
    </label>
  );
}
