"use client";

import { LogOut, Moon, Sun, Settings as SettingsIcon, Activity } from "lucide-react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useTheme } from "@/providers/ThemeProvider";

export function TopBar() {
  const { effective, setTheme } = useTheme();
  return (
    <nav
      className="sticky top-0 z-30 px-4 py-3 flex justify-between items-center bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <Link href="/dashboard" className="flex items-center gap-2 group">
        <div className="bg-gradient-to-br from-brand-500 to-brand-700 p-1.5 rounded-lg shadow-sm shadow-brand-500/20 group-hover:scale-105 transition-transform">
          <Activity className="text-white w-4 h-4" strokeWidth={2.5} aria-hidden />
        </div>
        <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-white">IronLog</span>
      </Link>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setTheme(effective === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          className="p-2.5 min-w-[40px] min-h-[40px] rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
        >
          {effective === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <Link
          href="/settings"
          aria-label="Settings"
          className="p-2.5 min-w-[40px] min-h-[40px] rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors flex items-center justify-center"
        >
          <SettingsIcon className="w-4 h-4" />
        </Link>
        <button
          onClick={() => signOut(auth)}
          aria-label="Sign out"
          className="p-2.5 min-w-[40px] min-h-[40px] rounded-full text-zinc-600 dark:text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
