/* Private responses are deliberately never placed in Cache Storage. */
const CACHE = "lifelevel-public-v1";
const SHELL = ["/offline.html", "/icons/icon.svg", "/icons/maskable.svg"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("lifelevel-public-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.searchParams.has("_rsc") || request.headers.get("RSC")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/offline.html")) || new Response("Offline", { status: 503 })));
    return;
  }
  const publicAsset = url.pathname.startsWith("/_next/static/") || SHELL.includes(url.pathname);
  if (!publicAsset) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.type === "basic") { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy))); }
    return response;
  }).catch(async () => (await caches.match(request)) || new Response("Offline", { status: 503 })));
});
