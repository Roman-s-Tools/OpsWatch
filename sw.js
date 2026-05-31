/* OpsWatch service worker — offline app shell + opportunistic runtime caching. */
const SHELL_CACHE = "opswatch-shell-v2";
const RUNTIME_CACHE = "opswatch-runtime-v1";
const TILE_CACHE = "opswatch-tiles-v1";

// Same-origin core that must be available offline. CDN libraries and map tiles
// are cached lazily on first use to keep installation reliable.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./ops-utils.js",
  "./script.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./crew-staffing/index.html",
  "./crew-staffing/style.css",
  "./crew-staffing/script.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  const keep = new Set([SHELL_CACHE, RUNTIME_CACHE, TILE_CACHE]);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => !keep.has(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (/\.tile\.openstreetmap\.org$/.test(url.hostname)) {
    event.respondWith(cacheFirst(request, TILE_CACHE));
    return;
  }

  // App shell / libraries: serve cached copy immediately, refresh in background.
  event.respondWith(staleWhileRevalidate(request));
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === "opaque")) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = (await caches.match(request)) || (await cache.match(request));
  const network = fetch(request)
    .then(response => {
      if (response && response.ok && new URL(request.url).protocol.startsWith("http")) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}
