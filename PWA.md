# Cross Road PWA

Player installation and backups: [README](README.md).

## Current public build

[Open Cross Road](https://qqclutchyqq.github.io/cross-road-ios/) in Safari and add it to the Home Screen. The deployed files are in `CrossRoad/Web`.

Normal launches automatically retrieve the configured Content manifest and stream verified file ranges from Cloudflare R2. Users do not need to download, extract, or choose a Content folder. The existing service worker caches the runtime shell and fetched Content blocks. Internet access remains necessary for uncached game data; this is not a promise that the complete Content library is available offline.

Game saves are local browser data in IndexedDB. Content hosting is a read path, not a save-upload service. Browser storage may be removed, so use the existing backup/export controls described in the README.

## Deploy with GitHub Pages

1. In **Settings → Pages**, choose **GitHub Actions** as the source.
2. Push the intended build to `main`, or run **Deploy Cross Road PWA**.
3. Confirm the deployment succeeds and open the public Play link.
4. Test Safari and the Home Screen app, including saved progress and diagnostics.

GitHub Pages provides HTTPS for workers and Home Screen installation. R2 public-read/CORS/cache configuration and client Content descriptors are already configured. Never place R2 credentials or API tokens in client files, commits, diagnostic reports, or the public site.

This documentation-only beta presentation release keeps the exact v14 runtime and cache version. A GitHub release tag snapshots the repository; the Play URL continues to serve the build deployed from `main`.

## Diagnostics and compatibility

Use **••• → Diagnostics** for the build/cache version, runtime log and audio lifecycle state. **Copy Diagnostics** and **Export Diagnostics** produce a diagnostic text report; they are distinct from save backups. Review any report before posting to [Discord](https://discord.gg/jHWEkRdjJb).

Physical-iPhone testing is the target. Device/OS compatibility reports are welcome; a desktop or simulator pass is not proof for every iPhone.

## Local testing and historical paths

Serve `CrossRoad/Web` from HTTPS or localhost. Opening HTML directly from Files does not provide the required secure worker origin. A different development origin may need its own Content-hosting CORS configuration; do not change production hosting just to follow these notes.

The existing `?localContent` path is available for manual-folder diagnostics; it is not normal installation. The original folder-import documentation, native server architecture, WASM conversion, constructors/JNI checks, build scripts and IPA experiment are preserved in [TECHNICAL.md](TECHNICAL.md).

