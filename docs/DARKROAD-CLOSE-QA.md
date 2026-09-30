# Dark Road native Close-control investigation

This is an opt-in diagnostic change, not a confirmed fix. Physical iPhone testing is required. The reported environment is iOS 18.7, Home Screen PWA v14. Bottom navigation works while several native X controls, including battle Options, fail to dismiss their modal.

## What is established

- Existing physical-device traces show complete BEGIN/END delivery through the worker into native code, often returning in 0–1 ms with no Content reads. This reproduction does not require a Content stall.
- The user reports a visible touch light/trail over X. That confirms a game touch effect, not that the X registered a native button press.
- Browser input uses the same native entry points for working navigation and failing X controls. Native hit testing and modal ownership are inside the game, not separate HTML buttons.
- Read-only inspection of the source ARM64 library identifies native Begin at `0xb62b8c`, End at `0xb62bfc`, Move at `0xb62c6c`, and Cancel at `0xb62e34`. Begin/End forward an integer contact ID and scalar floating-point coordinates. Move/Cancel use JNI arrays. End uses the supplied coordinates; it does not simply reuse Begin's position.
- A terminal event over the stage is not by itself evidence of bad coordinates. The existing mapping can clamp outside coordinates to the canvas edge; a failing X trace is needed to establish relevance.

The X hit rectangle, native touch claim/swallow state, and cause of failure have not been identified. No native hit-target identity is exposed by this probe. A complete transport trace alone cannot establish correct native modal dispatch.

## Optional probe

In the existing Diagnostics screen, select **Record Close-control traces**. The report includes marker `close-probe-1`. Recording is off by default and resets on page reload. Stop recording after the short comparison.

The probe records raw and transmitted coordinates, movement, duration, bounds changes, capture before release, worker frame separation, and the existing native input entry/coordinate arguments. It does not insert MOVE events, delay END, change contact IDs, alter coordinate mapping, or perform additional native calls. Existing diagnostic export filtering includes these `[touch probe]` lines. No save contents or credentials are collected.

## Physical comparison

1. Enable recording, close the custom Diagnostics panel, and use a working Dark Road navigation control such as Home.
2. Enter a battle, open Options, and tap its native X. Note whether X itself depresses or changes appearance, separately from the touch trail.
3. If still open, try one brief stationary hold/release and one small slide that stays inside X. Note which, if any, closes it.
4. Reopen Diagnostics, stop recording, and use **Export Diagnostics**. Include the order of attempts and observed outcomes.
5. Repeat for a second failing native X. Keep each report short enough that recent-log limits do not discard the useful comparison.

Compare BEGIN/END native positions, clamping, rectangle changes, contact lifetime/capture, and frame separation against the working control. None of these measurements independently proves that the native X claimed the touch. Do not change timing, add a synthetic MOVE, or add an HTML interception overlay solely on suspicion.

## Regression/acceptance checklist

- Repeated battle Options X open/close and other X-based submenus.
- Working bottom navigation and Home.
- Normal battle card swipes.
- KHUX native popup/submenu open/close.
- No click-through, stuck contact, stacked dimming, or lost-input regression.

Automated coverage (`node scripts/test-close-probe.cjs`) compares probe-on/off event messages and native scalar/array arguments, terminal fallback, capture release, cancellation, stale-contact recovery, menu isolation, and frame correlation. These checks validate diagnostic noninterference; they do not reproduce the native X failure or replace physical-device acceptance.
