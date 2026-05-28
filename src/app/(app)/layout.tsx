import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { PWARegister } from "@/components/PWARegister";
import { TimerProvider } from "@/providers/TimerProvider";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <TimerProvider>
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
          <TopBar />
          <main className="max-w-md mx-auto p-4 pb-32">{children}</main>
          <BottomNav />
          <PWARegister />
        </div>
      </TimerProvider>
    </AuthGate>
  );
}
