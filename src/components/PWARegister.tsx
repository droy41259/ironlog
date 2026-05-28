"use client";

import { useEffect } from "react";

/**
 * Registers the service worker AND auto-reloads the page when a new version
 * is deployed. No more "hard refresh to see updates."
 *
 * Flow on a new deploy:
 *   1. Page polls the SW for updates every 60s.
 *   2. Browser installs the new sw.js in the background when it appears.
 *   3. New SW reaches "installed" state — we postMessage SKIP_WAITING.
 *   4. New SW activates and calls clients.claim().
 *   5. clients.claim fires `controllerchange` on the page.
 *   6. We reload — guarded with a flag so we never loop.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let pollId: number | undefined;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Poll for SW updates every minute while the page is open
        pollId = window.setInterval(() => {
          reg.update().catch(() => {});
        }, 60_000);

        const promptUpdate = (worker: ServiceWorker) => {
          worker.postMessage({ type: "SKIP_WAITING" });
        };

        // If a waiting worker already exists from a previous visit, activate it now
        if (reg.waiting && navigator.serviceWorker.controller) {
          promptUpdate(reg.waiting);
        }

        // Watch for new workers showing up while the page is open
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            // Only prompt on real updates (when an old SW is already in control)
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              promptUpdate(newWorker);
            }
          });
        });
      })
      .catch(() => {
        /* best-effort */
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (pollId !== undefined) window.clearInterval(pollId);
    };
  }, []);

  return null;
}
