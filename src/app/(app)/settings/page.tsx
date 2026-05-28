"use client";

import { useState } from "react";
import { signOut, sendPasswordResetEmail, deleteUser } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Scale, Palette, Mail, LogOut, AlertTriangle, Target, RotateCcw, Timer } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useUnits } from "@/providers/UnitsProvider";
import { useToast } from "@/providers/ToastProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Confirm } from "@/components/ui/Confirm";
import { useMuscleTargets, type DisplayMuscle } from "@/hooks/useMuscleTargets";
import { useTrackedMuscles } from "@/hooks/useTrackedMuscles";
import { useRestTimerEnabled } from "@/hooks/useRestTimerEnabled";
import { ALL_MUSCLE_ROWS } from "@/components/dashboard/MuscleBalance";
import { Check } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { units, setUnits } = useUnits();
  const toast = useToast();
  const router = useRouter();
  const [resetting, setResetting] = useState(false);

  const resetPassword = async () => {
    if (!user?.email) return;
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success("Reset email sent");
    } catch {
      toast.error("Couldn't send right now.");
    } finally {
      setResetting(false);
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    try {
      await deleteUser(user);
      router.push("/login");
    } catch {
      toast.error("Sign out and back in, then try again.");
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Settings</h1>

      {/* Units */}
      <Card className="p-5">
        <Section icon={<Scale className="w-4 h-4" />} title="Units">
          <Tabs
            value={units}
            options={[
              { value: "kg", label: "Kilograms" },
              { value: "lb", label: "Pounds" },
            ]}
            onChange={(v) => setUnits(v as "kg" | "lb")}
          />
        </Section>
      </Card>

      {/* Theme */}
      <Card className="p-5">
        <Section icon={<Palette className="w-4 h-4" />} title="Theme">
          <Tabs
            value={theme}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ]}
            onChange={(v) => setTheme(v as "light" | "dark" | "system")}
          />
        </Section>
      </Card>

      {/* Rest timer toggle */}
      <RestTimerToggle />

      {/* Which muscles to track */}
      <TrackedMusclesEditor />

      {/* Muscle targets */}
      <MuscleTargetsEditor />

      {/* Account */}
      <Card className="p-5 space-y-3">
        <Section icon={<Mail className="w-4 h-4" />} title="Account">
          <div className="text-sm text-zinc-500 dark:text-zinc-400 break-all">{user?.email}</div>
          {user && !user.emailVerified && (
            <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" /> Email not verified.
            </div>
          )}
        </Section>
        <Button variant="secondary" onClick={resetPassword} loading={resetting} className="w-full">
          Send password reset email
        </Button>
        <Button variant="secondary" onClick={() => signOut(auth)} className="w-full">
          <LogOut className="w-4 h-4" /> Sign out
        </Button>
        <Confirm
          title="Delete account?"
          message="This permanently removes your sign-in. Workout data deletion is handled separately by Firebase."
          confirmLabel="Delete"
          destructive
          onConfirm={deleteAccount}
          trigger={(open) => (
            <Button variant="ghost" onClick={open} className="w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
              Delete account
            </Button>
          )}
        />
      </Card>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-bold text-zinc-700 dark:text-zinc-300 text-sm flex items-center gap-2">
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

function RestTimerToggle() {
  const { enabled, setEnabled } = useRestTimerEnabled();
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-bold text-zinc-700 dark:text-zinc-300 text-sm flex items-center gap-2">
            <Timer className="w-4 h-4" /> Rest timer
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Auto-start a countdown after completing a set.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          role="switch"
          aria-checked={enabled}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors ${
            enabled ? "bg-brand-500" : "bg-zinc-300 dark:bg-zinc-700"
          }`}
        >
          <span
            className={`inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${
              enabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </Card>
  );
}

function TrackedMusclesEditor() {
  const { tracked, toggle, reset } = useTrackedMuscles();
  return (
    <Card className="p-5 space-y-3">
      <Section icon={<Target className="w-4 h-4" />} title="Tracked muscles">
        <p className="text-xs text-zinc-500">
          Choose which muscles show up on your dashboard balance. Care about glutes more than chest? Toggle them.
        </p>
      </Section>
      <div className="grid grid-cols-2 gap-1.5">
        {ALL_MUSCLE_ROWS.map((r) => {
          const on = tracked.includes(r.key);
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => toggle(r.key)}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors text-left ${
                on
                  ? "bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/30 text-zinc-900 dark:text-white"
                  : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                <span className="truncate">{r.label}</span>
              </span>
              {on && <Check className="w-3.5 h-3.5 text-brand-500 shrink-0" strokeWidth={3} />}
            </button>
          );
        })}
      </div>
      <Button variant="ghost" onClick={reset} className="w-full text-xs text-zinc-500">
        <RotateCcw className="w-3 h-3" /> Reset to defaults
      </Button>
    </Card>
  );
}

function MuscleTargetsEditor() {
  const { targets, set, reset } = useMuscleTargets();
  const { tracked } = useTrackedMuscles();
  // Only show targets for muscles the user actually tracks
  const visibleRows = ALL_MUSCLE_ROWS.filter((r) => tracked.includes(r.key));
  return (
    <Card className="p-5 space-y-3">
      <Section icon={<Target className="w-4 h-4" />} title="Weekly muscle targets">
        <p className="text-xs text-zinc-500">
          Working sets per muscle per week. Tap a number to edit. Add muscles above to set their targets.
        </p>
      </Section>
      <ul className="space-y-2">
        {visibleRows.map((r) => (
          <li key={r.key} className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
            <span className="flex-1 text-sm font-semibold text-zinc-700 dark:text-zinc-200">{r.label}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => set(r.key as DisplayMuscle, targets[r.key as DisplayMuscle] - 1)}
                aria-label={`Decrease ${r.label}`}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-bold text-sm flex items-center justify-center"
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={targets[r.key as DisplayMuscle]}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (Number.isFinite(n)) set(r.key as DisplayMuscle, n);
                }}
                className="w-12 text-center bg-zinc-50 dark:bg-zinc-800 rounded-lg py-1.5 font-bold text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-brand-500 outline-none"
                style={{ fontVariantNumeric: "tabular-nums" }}
              />
              <button
                type="button"
                onClick={() => set(r.key as DisplayMuscle, targets[r.key as DisplayMuscle] + 1)}
                aria-label={`Increase ${r.label}`}
                className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-bold text-sm flex items-center justify-center"
              >
                +
              </button>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="ghost" onClick={reset} className="w-full text-xs text-zinc-500">
        <RotateCcw className="w-3 h-3" /> Reset to defaults
      </Button>
    </Card>
  );
}

function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl flex">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors min-h-[40px] ${
            value === o.value
              ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
