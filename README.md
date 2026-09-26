# Cross Road for iPhone — experimental

A native iOS application target for the uploaded KHUX/Dark Road Cross Road preservation runtime. It has a Home Screen icon and hosts the bundled runtime inside WKWebView. It does not open Safari or install a PWA. The game still renders through WebKit's WebGL implementation.

**Status:** the first physical-iOS archive/IPA build succeeded on GitHub Actions. The workflow also checks native runtime initialization in an iOS Simulator before publishing an experimental release. Full gameplay still requires testing on an actual iPhone with game content. The original and converted WASM passed 101 native constructors and JNI initialization in local Node/Chromium tests; those tests alone do not prove iOS gameplay.

## Download and install

The **Build iPhone IPA** GitHub Action builds on a hosted Mac. You do not need your own Mac. Open a successful run and download the `CrossRoad-iPhone-unsigned` artifact. Extract it to obtain `CrossRoad-unsigned.ipa`.

That is a real compiled iOS app package, **but it must be signed and installed through a sideloading tool before it can run**. A GitHub download link alone is not an iOS installer. For example, a user can use an appropriately configured AltStore/SideStore setup. Account provisioning, supported device/OS versions, renewal rules, and installation limits come from the chosen sideloading method; this project does not bypass them.

## First launch

1. Extract the compatible `Content.zip` into a folder accessible in the iPhone Files app.
2. Launch Cross Road from its own Home Screen icon.
3. Open Game options (•••), then **Import extracted Content folder**.
4. Keep the app foregrounded during the copy. Enough free space for both the source and imported copy is needed.
5. Later launches start directly into the game using the imported local files. No external server, PC, or active internet connection is needed for the intended local runtime path.

The uploaded archive contains the runtime, not Content. Content compatibility and full offline gameplay have not yet been tested. If content is bundled by a future build, the import can be skipped. To bundle it, put its extracted files in `CrossRoad/Content/` before building; those files are intentionally ignored by Git. Changing content retains old imported folders rather than deleting them silently.

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

Xcode with the iOS SDK, Node.js, and the selected command-line tools are required. No CocoaPods/SPM package installation is required. `scripts/generate-project.cjs` generates the checked-in Xcode project; `scripts/make-icon.swift` builds the icon asset.

The shell script archives for a physical iPhone (`iphoneos`), with signing disabled, and packages `Payload/CrossRoad.app` into the unsigned IPA. It never substitutes a simulator binary. To produce a device-provisioned signed IPA, configure your signing team/certificate/profile in Xcode and export a development or ad-hoc archive for the permitted devices. Do not put signing credentials in this repository.

## Device validation still required

Minimum configured iOS: 17.0, because worker OffscreenCanvas WebGL is required. The native picker replaces the browser-only directory-picker requirement.

Use **Run boot diagnostic** first if the game fails. Pass criteria for initialization: worker WebGL, 101 constructors and JNI `0x10004`. Full-game criteria: nativeRender, first render-loop iteration, a visibly drawn title/game screen, working touch/audio, save/relaunch round-trip, and airplane-mode launch. Large WASM compilation, WebKit memory pressure, loopback synchronous-read performance, background suspension/save flushing, video codecs, and device-specific graphics behavior remain risks until measured on hardware. Web content termination is surfaced as a native error.

The build workflow must succeed before any downloadable IPA can be claimed. An IPA being packaged is not the same as an on-device gameplay pass. A signed install that still fails to initialize must be treated as a failed test, not a finished release.

## Provenance

Original `Cross Road.zip` SHA-256: `963DA2019A04327BFA6CD50F9A58A243AD351B61C56F63AFC4E1270DDB4997F7`. Original archive remains untouched. Preserve the original Cross Road author credits in the bundled HTML. This repository does not assert ownership or a new license over the bundled third-party game/runtime material.
