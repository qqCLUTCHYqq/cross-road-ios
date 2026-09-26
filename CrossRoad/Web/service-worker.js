const CACHE = 'cross-road-pwa-v1';
const SHELL = ['./', './index.html', './game.html', './manifest.webmanifest', './pwa.css', './pwa-loader.js', './app.js', './runtime-worker.js', './aot-browser.json', './aot-runtime.json', './libcocos2dcpp-aot.wasm.gz', './libcocos2dcpp-image.bin.gz', './icons/crossroad-192.png', './icons/crossroad-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok && (request.destination === 'script' || request.destination === 'style' || request.destination === 'font' || request.destination === 'image' || request.url.endsWith('.wasm.gz') || request.url.endsWith('.bin.gz'))) {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});
