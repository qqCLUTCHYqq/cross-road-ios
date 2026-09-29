# Technical / Preservation Documentation

For the current player instructions, see [README](README.md). For the current browser deployment, see [PWA.md](PWA.md).

## Current release baseline

The runtime approved by the maintainer for public testing is v14, commit [9e06b47b578c245a00b222977f0edc61358266f4](https://github.com/qqCLUTCHYqq/cross-road-ios/commit/9e06b47b578c245a00b222977f0edc61358266f4). The public-release presentation pass changes documentation and support files only. It does not change the runtime, saves, Content hosting, or the service-worker cache.

The v14 implementation records lifecycle/refill diagnostics and renews browser audio output on a return gesture. The PCM timing and mixer remain as previously tested. Earlier development notes below describe their own point in time; they are not current PWA installation instructions or a claim that every device has been tested.

## Compatibility maintenance rules

The known-good physical-iPhone runtime takes precedence over cleanup. The code-health pass adds document-lifetime installer guards, resource ownership names, stable diagnostic prefixes, and developer checks/documentation. It does not retune input, audio, storage, layout, file reads, or caching. Re-run physical-iPhone acceptance tests before claiming device behavior is unchanged.

### Generated and upstream-derived material

| Files | Maintenance rule |
| --- | --- |
| `CrossRoad/Web/app.js` | Upstream-derived bundled/minified application and Svelte UI, with compatibility patches. Contains the working PCM graph, queue reporter, browser/worker bridge and game controls. Do not format, rename symbols, split, or broadly clean up this bundle. Preserve existing patches when updating from upstream; the original full source/build pipeline is not established by this repository. |
| `CrossRoad/Web/runtime-worker.js` | Upstream-derived bundled native/AOT compatibility runtime with targeted patches and a trailing `bootProbe` wrapper. Preserve bundle ordering and native ABI. Header comments map responsibilities; they do not define safe extraction points. |
| `game.html`, `aot-browser.json`, `aot-runtime.json`, `libcocos2dcpp-aot.wasm.gz`, `libcocos2dcpp-image.bin.gz` | Preserved/generated runtime interface, metadata and game artifacts. Treat metadata and binaries as a matched set; never regenerate, reformat or patch artifacts merely for cleanliness. |
| `mobile-runtime.js`, `mobile-menu.js`, `diagnostics.js`, `audio-lifecycle.js` | Hand-maintained compatibility/presentation helpers. Keep changes targeted and preserve the contracts below. The `DIAGNOSTIC_BUILD` line is a generated mirror, not an independently chosen version. |

### Installation and ownership

`installMobileInterface(audio)` and `installGameMenu(options)` are document-lifetime installations. Guards are stored on `document` under `Symbol.for('crossroad.mobile-interface')` and `Symbol.for('crossroad.game-menu')`, so repeated calls (including a second evaluation of the module) do not install resources again. The first audio adapter and `afterRestart` callback remain the owners. Repeated menu installation returns the same `{button, show, hide}` API; repeated mobile installation keeps its original undefined return. These are not hot-replacement APIs.

Initialization is synchronous and assumes the existing `#app` and `#play-area` are ready. A guard is reserved before side effects. If initialization throws, reload the document; do not clear the guard and blindly repeat partially completed setup. No teardown is added on Stop, Restart, backgrounding, or BFCache restoration.

| Owner | Resources/lifetime |
| --- | --- |
| Mobile interface installation | Stylesheet reference and layout MutationObserver are retained on its document installation record. Existing document/window/visualViewport listeners remain attached for the document lifetime. The orientation callback schedules its existing one-shot animation frame. |
| Game menu installation | One dialog/button pair, proxy handlers, `safariLog` wrapper, panel MutationObserver and named `logInterval`. Fullscreen and stop listeners live with the document; dialog listeners live with its retained element. No field cloning, save logic, or canvas movement is introduced. |
| Diagnostic export (installed by the menu once) | Copy/share/download controls and existing live diagnostic interval. The download URL has its existing delayed revocation. These remain document-lifetime resources; adding generalized disposal would change ownership and is deferred. |
| `MobilePointer` | Canvas-specific listeners already have explicit removers in `handlers`; the existing `destroy()` ends the contact and removes them when the runtime releases that adapter. Do not apply the document installer guard to normal canvas replacement. |
| Audio lifecycle | Owns its existing timeout/serial and watched context; `invalidate()`, `replace()` and `reset()` already define their cleanup. Do not add a second teardown path. |

### Synchronous native file-read contract

`remote-files.js` and `native-files.js` run inside the dedicated runtime worker. Their `read(offset, length)` callbacks must synchronously return bytes to the native file I/O bridge while its call stack is active. A Promise is not a compatible return value. **Do not convert these reads to async `fetch` without redesigning the native synchronous file-read contract and its call sites.** These are not main-thread UI XHR calls.

The remote adapter synchronously requests same-origin `__content` blocks from the service worker. That service worker can asynchronously fetch/cache R2 ranges independently while the runtime worker waits. Remote blocks are 1 MiB, with a 24-block worker LRU; the service worker has a separate bounded Content cache. The native experiment's adapter requests loopback `native/file` ranges, using 256 KiB blocks and a 32-block LRU. Both validate offsets, HTTP status and returned lengths, and clamp reads at EOF. Preserve the distinction between the worker byte cache, service-worker Content cache, and IndexedDB saves.

### Audio lifecycle state and invariants

The audio implementation remains the v14 behavior. Its diagnostic prefix is now `[audio lifecycle]`; changing a prefix is not a scheduler change.

- `hidden` records the lifecycle's background decision; `active` permits PCM/reporting. `waiting` describes the need for a foreground gesture. `recovering` flags a recovery attempt; it is distinct from `gestureRefresh`, which remembers that the browser output route must be renewed on the first return tap even if its clock advances.
- `serial` invalidates late promises/timeouts. `epoch` identifies the worker refill generation; the reporter's request ID further correlates PCM and queue acknowledgements. Old acknowledgements/PCM must never reactivate a newer generation.
- `timer` owns the existing resume timeout/clock check. `watched` identifies the observed context; context state callbacks verify they still belong to the current graph. `savedFiles` temporarily preserves browser music/effect offsets during context replacement, not game-save contents.
- `lastSuspend`, `lastResume`, `result` and `replacements` are diagnostic state, not inputs for retuning the PCM mixer.

Background transition: `setBackground(true)` invalidates pending work, stops the reporter, resets scheduled PCM, records the reason and requests context suspension without waiting on its promise. Foreground transition may attempt `open(false)`; a trusted gesture invokes recovery/replacement when required. Replacement disconnects/stops the old graph and closes its context without waiting, then rebuilds the existing output path. A fresh context starts reporting only when running; the existing clock check detects a stalled route. Restart uses the existing reset/replacement path. Native game/save state stays alive across audio recovery.

Never chain recovery behind an old unresolved WebKit suspend/resume/close promise. Never accept stale worker audio, create overlapping old/new PCM playback, or recreate the context on every normal gesture. Keep the current 20 ms reporting interval, 240 ms refill target, 50 ms scheduling lead, sample-rate handling, and existing 350 ms clock check/1200 ms resume timeout unchanged without targeted evidence and physical-device testing. The cleanup pass changes none of these values or transitions.

### Build identity and service-worker invariants

The authoritative shell identity is `CACHE` in `CrossRoad/Web/service-worker.js`. `DIAGNOSTIC_BUILD` mirrors it for reports; diagnostic status and exported filenames derive their short version from that mirror. Validate with:

```sh
node scripts/check-build-identity.cjs
```

After a deliberately planned shell cache-name change, run `node scripts/check-build-identity.cjs --write` and review both values. This is a development-time mirror, not a runtime import or extra network dependency. The check does not modify the service worker. The independent Content cache version is not the shell version and must not be renamed as part of a cosmetic build-label change.

This pass deliberately leaves the service-worker file, cache names, shell list, `skipWaiting`, `clients.claim`, request strategies and Content cache untouched. Existing controlled clients may continue using the cached v14 shell; this pass does not force a rollout or cache reset. Stable `[touch]` / `[audio lifecycle]` labels identify subsystems; the diagnostic filter also accepts historical v12/v14 prefixes so retained/older logs remain exportable. Use the Git commit for exact source identity, rather than treating a subsystem label as a build ID.

### Future boundaries (documentation only)

Potential worker boundaries are graphics/native dispatch, filesystem/JNI shims, persistence, input translation, audio production, and worker scheduling/messages. Any extraction needs explicit ABI and ordering tests; do not split `runtime-worker.js` in a cleanup pass. The menu's possible future boundaries are panel relocation/proxies, dialog navigation/touch isolation, and diagnostic presentation. Do not split `mobile-menu.js` without evidence of a functional need: moving the original Svelte panels preserves their handlers, anchors and save-editor state.

### Regression checks for the code-health pass

Run `node scripts/test-code-health.cjs`, `node scripts/check-build-identity.cjs` and `node scripts/test-native-files.cjs`. The first test checks duplicate installers/module evaluations; the second checks diagnostic/cache consistency; the third exercises native ranged reads. No new dependencies are required.

The existing local development checks were also run against both the unchanged published baseline and the cleanup. Native/remote range tests and diagnostic export tests pass. Historical v7–v13 checks include old byte-equality assertions or outdated harness imports and already fail on the known-good v14 baseline. The old v14 snapshot check also detects the intended comments/guard/log changes; it is not a behavioral regression result. Its existing lifecycle/refill scenarios, pointer scenarios and PCM timing scenarios were separately run against current code without the obsolete historical equality assertions and passed. Direct comparisons confirm `app.js`, file adapters, service worker, CSS, game/WASM artifacts and other unlisted runtime files are byte-identical, and worker/audio implementation changes are limited to comments/log prefixes.

The local browser boot smoke also passed WebAssembly compilation, worker WebGL, 101 native constructors and JNI_OnLoad=0x10004. This validates native initialization, not full game rendering or physical-iPhone behavior.

The repository's `scripts/simulator-smoke.sh` requires macOS/Xcode. Use the existing GitHub Actions simulator job for that check; do not claim Windows/browser checks prove physical-iPhone behavior. Physical acceptance still covers normal play, all native KHUX menus, saves, R2 loading and repeated app-switch/lock audio recovery.

## Credits and acknowledgements

The bundled Cross Road runtime's original **Thanks and Acknowledgements** remain unmodified. They credit:

- [KHTomorrow (Purple)](https://x.com/khmltomorrow) — original icon design.
- [Breezyfeather](https://x.com/Breezyfeather) — inspiration through work on the franchise's fictional languages.
- The Albiel community — support and camaraderie.
- [KHUxTools](https://github.com/thethiny/KHUxTools/) — tools and file exploration.
- [Rellume](https://github.com/aengelke/rellume) — machine-code lifting to LLVM IR.
- [Emscripten](https://github.com/kripken/emscripten) — WebAssembly compilation.
- [Vite](https://vite.dev/) and [Svelte](https://svelte.dev/) — build tooling and interface.

The native experiment's ZIPFoundation 0.9.20 acknowledgement and MIT-license bundling instructions remain in the archived documentation below. No license or ownership claim is added over third-party material.

## Historical README (preserved verbatim)

The full README from the runtime baseline follows unchanged, including its earlier player/support notes and native implementation history. Links and status claims in this archived section belong to that historical document.

---

# [▶ PLAY / OPEN CROSS ROAD](https://qqclutchyqq.github.io/cross-road-ios/)

Play Kingdom Hearts Union χ and Dark Road on your iPhone. Tap the big Play link above, then **Launch game**.

## Add Cross Road to your iPhone Home Screen

1. Open the **Play** link above in **Safari**.
2. Tap **Share**.
3. Tap **Add to Home Screen**.
4. Launch **Cross Road** from the new Home Screen icon.

**Game Content loads automatically.** KHUX/Dark Road Content comes from the configured remote Content hosting. You do not need to manually download, extract, or select a Content folder. Keep an internet connection available while playing; game data is downloaded as needed and cached on your device.

---
## 💾 Save Data and Backups

Your KHUX/Dark Road progress is saved **locally on the device/browser you play on**. Your save is not stored in GitHub or Cloudflare.

- **Normal saving:** Save and play normally. Your progress should still be there when you close and reopen Cross Road on the same device/browser.
- **Back up your save:** Open **••• → Save Data** and use the existing export/backup option. On iPhone, save the exported file to **Files → On My iPhone** or **iCloud Drive**.
- **Restore a save:** Open **••• → Save Data** and use the existing import/restore option to select your backup.
- **Important:** Clearing Safari website data can remove locally stored save data. Keep an exported backup if your progress matters.
- **Updates:** Normal updates to the PWA are intended to preserve existing local saves.

For the safest experience, export a backup before removing/reinstalling the PWA or making major changes.
---
## 🌙 Need Help? Join Traverse Town

Need help getting Cross Road running on iPhone or iPad? Found a bug, have an idea, or want to follow development?

**[Join the Traverse Town Discord](https://discord.gg/jHWEkRdjJb)**

Traverse Town is the official community home for Cross Road.

Come by for:

- 🛠️ iPhone/iPad setup help
- 💾 Save and backup help
- 🐛 Bug reports and troubleshooting
- 💡 Suggestions and feature ideas
- 📢 Cross Road development updates
- 🗝️ KINGDOM HEARTS discussion

---
---
## Technical and preservation documentation

The documentation below preserves the project’s technical history, including the earlier native iPhone app experiment. Its IPA installation and manual Content instructions are for that older experiment; use the Play link above for the current iPhone experience.

# Cross Road preservation build

The primary deliverable is now the Safari/PWA build in [PWA.md](PWA.md). It is designed for an HTTPS GitHub Pages URL, iPhone Safari, and Add to Home Screen installation. The native iOS project and unsigned IPA workflow remain as historical experiments.

A native iOS application target for the uploaded KHUX/Dark Road Cross Road preservation runtime. It has a Home Screen icon and hosts the bundled runtime inside WKWebView. It does not open Safari or install a PWA. The game still renders through WebKit's WebGL implementation.

**Status:** the first physical-iOS archive/IPA build succeeded on GitHub Actions. The workflow also checks native runtime initialization in an iOS Simulator before publishing an experimental release. Full gameplay still requires testing on an actual iPhone with game content. The original and converted WASM passed 101 native constructors and JNI initialization in local Node/Chromium tests; those tests alone do not prove iOS gameplay.

## Download and install

The **Build iPhone IPA** GitHub Action builds on a hosted Mac. You do not need your own Mac. Open a successful run and download the `CrossRoad-iPhone-unsigned` artifact. Extract it to obtain `CrossRoad-unsigned.ipa`.

That is a real compiled iOS app package, **but it must be signed and installed through a sideloading tool before it can run**. A GitHub download link alone is not an iOS installer. For example, a user can use an appropriately configured AltStore/SideStore setup. Account provisioning, supported device/OS versions, renewal rules, and installation limits come from the chosen sideloading method; this project does not bypass them.

## First launch

1. Launch Cross Road from its own Home Screen icon.
2. Open Game options (•••), then **Download game content (2.24 GB)**.
3. Keep the app open on Wi-Fi while it downloads, verifies and unpacks the content. Allow several GB of free space. This first version restarts an interrupted download; it does not yet offer resume.
4. Alternatively, extract a compatible `Content.zip` in Files and use **Import extracted Content folder**.
5. Later launches start directly into the game using the local files. No external server, PC, or active internet connection is needed for the intended local runtime path.

The uploaded archive contains the runtime, not Content. The setup downloader uses the original Archive.org preservation item, verifies its exact 2,244,643,150-byte size and published SHA-1, then extracts with CRC/path checks. The uploaded ZIP's MD5 matches that item's `v2/Cross Road.zip`. Content compatibility and full offline gameplay still need device testing. If content is bundled by a future build, setup can be skipped. To bundle it, put extracted files in `CrossRoad/Content/` before building; those files are intentionally ignored by Git. Changing content retains old imported folders rather than deleting them silently.

## Architecture

- UIKit app lifecycle, native folder import, native diagnostic/share menu, persistent WKWebView.
- Bundled JavaScript, WASM, metadata and native image; no CDN runtime dependencies.
- Memory64 lowered to wasm32 using Binaryen 123.0.0, retaining the BigInt native-dispatch ABI.
- An HTTP service bound only to `127.0.0.1:18761` serves bundled resources and native file ranges. It is internal to the phone; it is not a LAN hosting requirement. Resource URLs require a random per-launch path token.
- A stable origin preserves the separate `crossroad-ios-v1` IndexedDB save database across normal launches. Keep the bundle identifier stable across updates and do not uninstall to preserve app data.
- The worker receives small file descriptors, not all game files. Synchronous worker XHR reads native file ranges through a global 8 MiB block cache. Native game reads remain synchronous without loading the entire Content collection into JavaScript memory.
- The runtime starts automatically once content is available. A native menu exposes restart, diagnostics, content replacement and log sharing.
- Source artwork for the Home Screen icon is the uploaded archive's icon; the build produces the required opaque app-icon asset.

## Build locally on a Mac

```sh
bash scripts/build-ipa.sh
```

Xcode with the iOS SDK, Node.js, and the selected command-line tools are required. Xcode resolves ZIPFoundation 0.9.20 through Swift Package Manager for streaming archive extraction; no CocoaPods setup is needed. `scripts/generate-project.cjs` generates the checked-in Xcode project; `scripts/make-icon.swift` builds the icon asset. ZIPFoundation's MIT license is copied into the bundled Web resources during the build.

The shell script archives for a physical iPhone (`iphoneos`), with signing disabled, and packages `Payload/CrossRoad.app` into the unsigned IPA. It never substitutes a simulator binary. To produce a device-provisioned signed IPA, configure your signing team/certificate/profile in Xcode and export a development or ad-hoc archive for the permitted devices. Do not put signing credentials in this repository.

## Device validation still required

Minimum configured iOS: 17.0, because worker OffscreenCanvas WebGL is required. The native picker replaces the browser-only directory-picker requirement.

Use **Run boot diagnostic** first if the game fails. Pass criteria for initialization: worker WebGL, 101 constructors and JNI `0x10004`. Full-game criteria: nativeRender, first render-loop iteration, a visibly drawn title/game screen, working touch/audio, save/relaunch round-trip, and airplane-mode launch. Large WASM compilation, WebKit memory pressure, loopback synchronous-read performance, background suspension/save flushing, video codecs, and device-specific graphics behavior remain risks until measured on hardware. Web content termination is surfaced as a native error.

The build workflow must succeed before any downloadable IPA can be claimed. An IPA being packaged is not the same as an on-device gameplay pass. A signed install that still fails to initialize must be treated as a failed test, not a finished release.

## Provenance

Original `Cross Road.zip` SHA-256: `963DA2019A04327BFA6CD50F9A58A243AD351B61C56F63AFC4E1270DDB4997F7`. Original archive remains untouched. Preserve the original Cross Road author credits in the bundled HTML. This repository does not assert ownership or a new license over the bundled third-party game/runtime material.

---

## Historical PWA documentation (preserved verbatim)

This earlier document describes the manual-folder import path. Normal public launches now load remote Content automatically.

# Cross Road PWA

The Safari build is in `CrossRoad/Web`. It includes the converted wasm32 runtime, an install manifest, service-worker caching, iPhone safe-area metadata, and an IndexedDB bridge. The first time a user chooses the extracted `Content` folder, the bridge stores the selected files on that device and restores them automatically on later launches.

## Deploy with GitHub Pages

1. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
2. Push to `main`, or run **Deploy Cross Road PWA** from the Actions tab.
3. Open `https://qqclutchyqq.github.io/cross-road-ios/` in Safari on iPhone.
4. Tap **Share → Add to Home Screen**, then launch **Cross Road** from the new icon.
5. The first launch needs an extracted compatible `Content` folder. After the initial selection, the PWA saves the files in IndexedDB and restores them without another folder selection.

GitHub Pages supplies HTTPS, which is required for service workers and installability. The site shell can run offline after its first visit; game content is kept in browser storage and is not committed to GitHub or bundled into the site. iOS storage quotas vary, so importing a 2.24 GB folder may require a device with sufficient free space.

For a quick local test, serve `CrossRoad/Web` from an HTTPS or localhost server and open `index.html`. Opening the files directly from the Files app will not work because service workers and WebAssembly workers need a secure origin.


