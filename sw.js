/* Kitchen Inventory — service worker.
   Caches the app shell + the supabase-js library so the app boots offline
   (grocery-store use case). Supabase API traffic is never cached — those
   requests hit the network and, when they fail, the app's own write queue
   takes over. */
const CACHE = 'kitchen-shell-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/dist/umd/supabase.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Supabase REST/Auth/Realtime: always network, never cached.
  if (url.hostname.endsWith('.supabase.co')) return;

  // Navigations: network-first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }

  // Shell assets + CDN library: cache-first, refill cache on success.
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        const cacheable =
          res.ok && (url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net');
        if (cacheable) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
