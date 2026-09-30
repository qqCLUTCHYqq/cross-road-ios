# KHUX submenu native dispatch investigation

## Reproduction on a real iPhone

AWS Device Farm run `9c69a939-a51b-4e96-ac3d-c41ed6c4fe67`, Apple iPhone 16 / iOS 18.6.2 Safari, public v15. The test uses real Appium touch actions at fixed guest coordinates, with screenshots and the existing Close probe. It stops at the first failed close.

Path: KHUX START → Player → Titles → Title B Edit → selection X.

The selection popup remains visible after X. Its list is empty, unlike the desktop reference. Guest `(934.7582,35.9288)` is at the visible X. Trace #4 records matched Begin/End, stable canvas bounds, no clamping, capture present, six frames between Begin and End, and zero reads during those two calls. This reproduces the failed close; it does not independently prove click-through or all other submenu failures.

The preceding touch #3 opens the selection popup. Its native End enters at frame **2917** and returns at frame **2918**, after 240 ms and 17 reads. The worker frame counter is incremented only by its render callback. A browser frame therefore re-entered the shared AOT/native runtime while the native touch callback was still on the stack. Native Cocos dispatch/modal initialization and the shared emulated machine are not safe for this interleaving. Synchronous worker reads provide the nested browser callback opportunity; their synchronous return contract must remain intact.

## v16 candidate

`crossroadSerialNativeDispatch` guards the existing worker frame and message callbacks. A callback arriving during an active native entry is queued FIFO and delivered after that entry returns. Ordinary non-reentrant callbacks still run synchronously. The guard adds no timer, synthetic touch, coordinate offset, native modal flag override, or new file-loading path. Diagnostic lines report the first eight deferrals without reading native/save data.

The candidate leaves browser Pointer Events, capture/release, terminal fallback, stale-contact recovery, native ABI, audio mixing/PCM timing, Content adapters, save format, and layout unchanged. Audio messages retain their existing age correction and acknowledgment; only an otherwise reentrant callback is deferred until native code is safe to enter.

`node scripts/test-native-dispatch.cjs` executes the real worker callback wiring with a frame and messages arriving inside native touch, verifies no overlap, FIFO delivery, unchanged ordinary synchronous input, and one audio acknowledgment. Existing close-probe, code-health, native-file and build-identity checks also pass.

Real-iPhone rerun is required to establish that preventing this measured re-entry fixes the modal. Keep the failing v15 artifacts and compare the same Titles path first, then repeat Name, Union, Outfits/change/Save/return and native Menu. Do not infer a fix merely from unit tests. Battle stalls, Dark Road and other systems are outside this patch.
