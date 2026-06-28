"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Trash2 } from "lucide-react";
import type { WorkoutSet } from "@/types/workout";
import { useUnits } from "@/providers/UnitsProvider";
import { fromKg, toKg } from "@/lib/units/converter";

interface Props {
  index: number;
  set: WorkoutSet;
  suggestion?: { kg: number; reps: number };
  canDelete: boolean;
  onChange: (patch: Partial<WorkoutSet>) => void;
  onDelete: () => void;
  onComplete: () => void;
}

/**
 * Input that keeps its own text state so the user can type intermediate values
 * like "20." or "0.5" without the canonical numeric state stomping them.
 */
function NumberField({
  externalValue,
  onValue,
  decimal,
  placeholder,
  className,
}: {
  externalValue: number;
  onValue: (n: number) => void;
  decimal: boolean;
  placeholder?: string;
  className?: string;
}) {
  const formatExternal = (v: number) => (v > 0 ? (Number.isInteger(v) ? v.toString() : v.toString()) : "");
  const [text, setText] = useState<string>(formatExternal(externalValue));
  const lastEmittedRef = useRef<number>(externalValue);

  // Sync from external changes (suggestion fill, voice, undo).
  // Skip when the external value matches what the user's text would parse to —
  // that means we're seeing our own emit echo back.
  useEffect(() => {
    if (externalValue === lastEmittedRef.current) return;
    setText(formatExternal(externalValue));
    lastEmittedRef.current = externalValue;
  }, [externalValue]);

  return (
    <input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={text}
      placeholder={placeholder}
      className={className}
      onChange={(e) => {
        let next = e.target.value;
        // Accept "," as decimal separator
        if (decimal) next = next.replace(",", ".");
        // Strip obvious junk; allow digits, single dot, leading nothing
        if (decimal) next = next.replace(/[^0-9.]/g, "");
        else next = next.replace(/[^0-9]/g, "");
        // Collapse multiple dots — keep only the first
        if (decimal) {
          const parts = next.split(".");
          if (parts.length > 2) next = parts[0] + "." + parts.slice(1).join("");
        }
        setText(next);
        const parsed = parseFloat(next);
        const out = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        lastEmittedRef.current = out;
        onValue(out);
      }}
    />
  );
}

export function SetRow({ index, set, suggestion, canDelete, onChange, onDelete, onComplete }: Props) {
  const { units } = useUnits();
  const showSuggestion = !set.completed && !set.kg && !set.reps && suggestion;

  // Display value for kg is in the user's chosen unit
  const displayKg = fromKg(set.kg, units);

  return (
    <div
      className={`grid grid-cols-[28px_1fr_1fr_auto] gap-2 items-center transition-opacity ${
        set.completed ? "opacity-60" : "opacity-100"
      }`}
    >
      <div className="text-center font-medium text-zinc-400 dark:text-zinc-600 text-sm">{index + 1}</div>

      <NumberField
        externalValue={displayKg}
        onValue={(v) => onChange({ kg: toKg(v, units) })}
        decimal
        placeholder={showSuggestion ? `${fromKg(suggestion!.kg, units).toFixed(1)}` : units}
        className="w-full text-center bg-zinc-50 dark:bg-zinc-800 rounded-lg py-2.5 font-bold text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-50 placeholder-zinc-300 dark:placeholder-zinc-600"
      />

      <NumberField
        externalValue={set.reps}
        onValue={(v) => onChange({ reps: Math.round(v) })}
        decimal={false}
        placeholder={showSuggestion ? `${suggestion!.reps}` : "reps"}
        className="w-full text-center bg-zinc-50 dark:bg-zinc-800 rounded-lg py-2.5 font-bold text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-50 placeholder-zinc-300 dark:placeholder-zinc-600"
      />

      <div className="flex items-center gap-1 justify-end">
        <button
          type="button"
          onClick={() => {
            onChange({ completed: !set.completed });
            // Fire the rest timer on completion. Only reps are required — bodyweight
            // moves (push-ups, pull-ups, dips) legitimately have kg === 0.
            if (!set.completed && set.reps > 0) onComplete();
          }}
          aria-label={set.completed ? "Mark set incomplete" : "Mark set complete"}
          className={`p-2 min-w-[44px] min-h-[44px] rounded-full transition-colors flex items-center justify-center ${
            set.completed
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          {set.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete set"
            className="p-2 min-w-[44px] min-h-[44px] rounded-full text-zinc-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
