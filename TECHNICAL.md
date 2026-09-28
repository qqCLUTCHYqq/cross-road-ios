# Technical / Preservation Documentation

For the current player instructions, see [README](README.md). For the current browser deployment, see [PWA.md](PWA.md).

## Current release baseline

The runtime approved by the maintainer for public testing is v14, commit [9e06b47b578c245a00b222977f0edc61358266f4](https://github.com/qqCLUTCHYqq/cross-road-ios/commit/9e06b47b578c245a00b222977f0edc61358266f4). The public-release presentation pass changes documentation and support files only. It does not change the runtime, saves, Content hosting, or the service-worker cache.

The v14 implementation records lifecycle/refill diagnostics and renews browser audio output on a return gesture. The PCM timing and mixer remain as previously tested. Earlier development notes below describe their own point in time; they are not current PWA installation instructions or a claim that every device has been tested.

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

