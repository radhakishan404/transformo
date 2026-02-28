const CACHE_VERSION = 'transformo-v2';
const APP_SHELL_CACHE = `${CACHE_VERSION}-app-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const CORE_ASSETS = [
  new URL('./', self.registration.scope).toString(),
  new URL('index.html', self.registration.scope).toString(),
  new URL('style.css', self.registration.scope).toString(),
  new URL('site.webmanifest', self.registration.scope).toString(),
  new URL('favicon.ico', self.registration.scope).toString(),
  new URL('icons/icon-192.png', self.registration.scope).toString(),
  new URL('icons/icon-512.png', self.registration.scope).toString(),
  new URL('offline.html', self.registration.scope).toString(),
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(cache => cache.addAll(CORE_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith('transformo-') && !name.startsWith(CACHE_VERSION))
        .map(name => caches.delete(name)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Keep WASM runtime files network-first to avoid stale JS/WASM mismatch.
  if (requestUrl.pathname.includes('/wasm/')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  const isAssetRequest =
    requestUrl.pathname.includes('/assets/') ||
    ['script', 'style', 'image', 'font'].includes(request.destination);

  if (!isAssetRequest) return;

  event.respondWith(staleWhileRevalidate(request));
});

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(APP_SHELL_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match(new URL('offline.html', self.registration.scope).toString());
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(response => {
      if (response.ok && (response.type === 'basic' || response.type === 'cors')) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkPromise;
}
