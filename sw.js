// Bumping CACHE also deletes the old hnhn-v2 cache, which held every API response.
const CACHE = "hnhn-v3";
const API_CACHE = "hnhn-api-v1";
const API_MAX = 300; // max cached API responses (offline fallback only)
const SHELL = ["/hnhn/", "/hnhn/index.html", "/hnhn/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE && k !== API_CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Cache keys are kept in insertion order, so the first keys are the oldest.
async function trim(cache, max) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

// Network first, fall back to cache. Only successful responses are cached.
function networkFirst(req, cacheName, max) {
  return fetch(req)
    .then((r) => {
      if (r.ok) {
        const clone = r.clone();
        caches.open(cacheName).then(async (c) => {
          await c.put(req, clone);
          if (max) await trim(c, max);
        });
      }
      return r;
    })
    .catch(() => caches.match(req).then((r) => r || Response.error()));
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  if (url.hostname === "hacker-news.firebaseio.com" || url.hostname === "api.newshacker.me") {
    e.respondWith(networkFirst(e.request, API_CACHE, API_MAX));
    return;
  }

  // Shell: network first so updates arrive without reinstall.
  e.respondWith(networkFirst(e.request, CACHE));
});
