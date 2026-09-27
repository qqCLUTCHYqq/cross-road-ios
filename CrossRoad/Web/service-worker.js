importScripts('./content-verify.js');
const CACHE = 'cross-road-pwa-audio-timing-v10';
const SHELL = ['./', './index.html', './game.html', './manifest.webmanifest', './pwa.css', './pwa-loader.js', './app.js', './mobile-runtime.js', './mobile-menu.js', './mobile-ui.css', './remote-files.js', './content-manifest.json', './content-verify.js', './runtime-worker.js', './aot-browser.json', './aot-runtime.json', './libcocos2dcpp-aot.wasm.gz', './libcocos2dcpp-image.bin.gz', './icons/crossroad-192.png', './icons/crossroad-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('cross-road-pwa-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method === 'GET' && url.origin === self.location.origin && url.pathname === new URL('./__content-manifest', self.registration.scope).pathname) { event.respondWith(contentManifestResponse()); return; }
  if (request.method === 'GET' && url.origin === self.location.origin && url.pathname === new URL('./__content', self.registration.scope).pathname) { event.respondWith(contentBlockResponse(url)); return; }
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(request)).then(cached => cached || fetch(request).then(response => {
    if (response.ok && (request.destination === 'script' || request.destination === 'style' || request.destination === 'font' || request.destination === 'image' || request.url.endsWith('.wasm.gz') || request.url.endsWith('.bin.gz'))) {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});

// Separate bounded cache: 256 one-MiB chunks (at most 256 MiB), never entire OBBs.
const CONTENT_CACHE = 'cross-road-content-khux-5.0.1-ww-20260926';
const MAX_CONTENT_BLOCKS = 256;
let contentManifestPromise, verificationPromise, cacheQueue = Promise.resolve();
function getContentManifest() {
  return contentManifestPromise ||= caches.open(CACHE).then(async cache => {
    const response = await cache.match('./content-manifest.json') || await fetch('./content-manifest.json');
    if (!response.ok) throw Error('Content manifest HTTP '+response.status);
    return response.json();
  }).catch(error=>{contentManifestPromise=null;throw error;});
}
async function contentManifestResponse() {
  try {
    const manifest = await getContentManifest();
    verificationPromise ||= verifyRemoteContent(manifest).catch(error=>{verificationPromise=null;throw error;});
    const verified = await verificationPromise;
    return Response.json({...manifest,verified},{headers:{'Cache-Control':'no-store'}});
  } catch(error) { return new Response(error.message,{status:503}); }
}
async function contentBlockResponse(url) {
  try {
    const manifest = await getContentManifest();
    const file = manifest.files.find(file=>file.path === url.searchParams.get('path'));
    const offset = Number(url.searchParams.get('offset'));
    if (!file || url.searchParams.get('version') !== manifest.version || !Number.isSafeInteger(offset) || offset < 0 || offset >= file.size || offset % manifest.blockSize) return new Response('Invalid Content range',{status:400});
    const cache = await caches.open(CONTENT_CACHE);
    const cached = await cache.match(url.href);
    if (cached) return cached;
    const end = Math.min(offset + manifest.blockSize, file.size) - 1;
    const target = new URL(file.path, manifest.baseURL);
    let response;
    for (let attempt=0;attempt<3;attempt++) {
      response = await fetch(target,{credentials:'omit',headers:{Range:'bytes='+offset+'-'+end},signal:AbortSignal.timeout(30000)});
      if (response.status !== 429 && response.status < 500) break;
      await response.body?.cancel();
      await new Promise(resolve=>setTimeout(resolve,1000 * 2 ** attempt));
    }
    // Reject a server ignoring Range BEFORE reading a multi-gigabyte body.
    if (response.status !== 206) { await response.body?.cancel(); throw Error('R2 range request HTTP '+response.status); }
    const range = response.headers.get('Content-Range');
    if (range !== 'bytes '+offset+'-'+end+'/'+file.size) { await response.body?.cancel(); throw Error('R2 returned an incorrect or inaccessible Content-Range'); }
    const data = await response.arrayBuffer();
    if (data.byteLength !== end-offset+1) throw Error('Incomplete Content range');
    const result = new Response(data,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(data.byteLength),'Cache-Control':'public, max-age=86400'}});
    // Serialize writes to keep the persistent cache bounded, including concurrent clients.
    const copy = result.clone();
    cacheQueue = cacheQueue.catch(()=>{}).then(async()=>{
      let keys = await cache.keys();
      while (keys.length >= MAX_CONTENT_BLOCKS) await cache.delete(keys.shift());
      await cache.put(url.href,copy);
    }).catch(error=>console.warn('Content cache unavailable; continuing online:',error.name));
    await cacheQueue;
    return result;
  } catch(error) { console.error('Remote Content:',error.message);return new Response(error.message,{status:502}); }
}
