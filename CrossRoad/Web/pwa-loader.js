'use strict';

// Safari/PWA bridge: retain one selected Content folder in IndexedDB and restore it
// into the existing runtime's folder input on later launches.
const DB_NAME = 'cross-road-pwa';
const DB_VERSION = 1;
const STORE = 'content-files';
const dbOpen = new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'path' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const status = document.createElement('div');
status.id = 'pwa-status';
status.setAttribute('role', 'status');
status.textContent = 'Cross Road is starting…';
status.style.cssText = 'position:fixed;z-index:9999;left:env(safe-area-inset-left,12px);right:env(safe-area-inset-right,12px);bottom:calc(env(safe-area-inset-bottom,0px) + 12px);padding:10px 14px;border-radius:12px;background:#142238e8;color:#eef6ff;font:14px system-ui;pointer-events:none;opacity:.9';
document.addEventListener('DOMContentLoaded', () => document.body.append(status), { once: true });
globalThis.safariLog = line => { console.log('[Cross Road]', line); status.textContent = String(line); };
globalThis.__pwaContent = { ready: false, count: 0 };

function pathOf(file) { return file.webkitRelativePath || file.relativePath || file.name; }
function withPath(file, path) { try { Object.defineProperty(file, 'webkitRelativePath', { value: path }); } catch {} return file; }
function transaction(mode) { return dbOpen.then(db => new Promise((resolve, reject) => {
  const tx = db.transaction(STORE, mode); const store = tx.objectStore(STORE); const result = [];
  if (mode === 'readonly') { const req = store.openCursor(); req.onsuccess = () => { const cursor = req.result; if (cursor) { result.push(cursor.value); cursor.continue(); } else resolve(result); }; req.onerror = () => reject(req.error); }
  else { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }
})); }
async function saveFiles(files) {
  const entries = Array.from(files, file => ({ path: pathOf(file), size: file.size, type: file.type, lastModified: file.lastModified, blob: file }));
  try {
    if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
    await dbOpen.then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE);
      store.clear(); entries.forEach(entry => store.put(entry)); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    }));
    globalThis.__pwaContent.count = entries.length;
    safariLog(`Saved ${entries.length.toLocaleString()} game files on this device.`);
  } catch (error) {
    safariLog(`Could not persist the game folder (${error.name || error}). Keep this tab open while playing.`);
  }
}
async function restoreFiles(input) {
  try {
    const entries = await transaction('readonly');
    if (!entries.length) return false;
    const transfer = new DataTransfer();
    for (const entry of entries) transfer.items.add(withPath(new File([entry.blob], entry.path.split('/').pop(), { type: entry.type, lastModified: entry.lastModified }), entry.path));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    globalThis.__pwaContent.ready = true; globalThis.__pwaContent.count = entries.length;
    safariLog(`Restored ${entries.length.toLocaleString()} saved game files.`);
    return true;
  } catch (error) { safariLog(`Saved content could not be restored: ${error.message || error}`); return false; }
}
function watchRuntimeInput() {
  const input = document.querySelector('#files');
  if (!input) return false;
  if (input.dataset.pwaBound) return true;
  input.dataset.pwaBound = '1';
  input.addEventListener('change', () => { if (input.files?.length) saveFiles(input.files); }, true);
  restoreFiles(input);
  return true;
}
const observer = new MutationObserver(watchRuntimeInput);
observer.observe(document.documentElement, { childList: true, subtree: true });
const timer = setInterval(() => { if (watchRuntimeInput()) clearInterval(timer); }, 250);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./service-worker.js').catch(error => safariLog(`Offline cache unavailable: ${error.message}`));
