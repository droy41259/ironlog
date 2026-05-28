/* Network-first SW. Fixes "stale on one device" by always trying the network
   for page navigations and only falling back to cache when offline.
   Bump CACHE on releases to force-evict the old shell. */

const CACHE = "ironlog-shell-v4";
const STATIC = ["/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        STATIC.map((url) =>
          fetch(url, { cache: "no-cache" })
            .then((r) => (r.ok ? cache.put(url, r.clone()) : null))
            .catch(() => null),
        ),
      ),
    ),
  );
  // Activate immediately on first install
  self.skipWaiting();
});

// Allow the page to tell us to skip waiting on subsequent updates
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      // Take control of open clients so they get the new SW immediately.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations: network-first, fall back to cache only when offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match("/dashboard"))),
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) =>
      cached ??
      fetch(request).then((resp) => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return resp;
      }),
    ),
  );
});
