// Shared by the service worker and the browser's read-only verification page.
async function verifyRemoteContent(manifest, report = () => {}) {
  const results = [];
  for (const file of manifest.files) {
    const url = new URL(file.path, manifest.baseURL);
    const response = await fetch(url, {method:'HEAD', credentials:'omit', cache:'no-store', signal:AbortSignal.timeout(30000)});
    const length = response.headers.get('Content-Length');
    const size = length === null ? null : Number(length);
    const row = {path:file.path, expected:file.size, actual:size, status:response.status, cacheControl:response.headers.get('Cache-Control'), ok:response.ok && size === file.size};
    results.push(row); report(row);
    if (!row.ok) throw Error('R2 verification failed: ' + file.path + ' expected ' + file.size + ', received ' + size + ' (HTTP ' + response.status + ')');
  }
  return results;
}
