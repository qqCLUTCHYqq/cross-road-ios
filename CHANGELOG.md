# Changelog

Player-facing changes are grouped under Added, Fixed, and Known Issues for each release.

## v1.0.0-beta

First public iPhone/PWA beta presentation of the existing v14 runtime.

### Added

- KHUX and Dark Road through Safari and the iPhone/iPad Home Screen.
- Automatic remote Content retrieval and caching as data is used.
- Mobile touch controls, portrait/landscape support and in-game menu navigation.
- Game audio and lifecycle diagnostics.
- Local progress persistence, Save Game Editor, and backup/import tools.
- Copy/Export Diagnostics, player Quick Start, Discord support and a GitHub bug-report template.

### Fixed

- Incorporates the existing v14 app-switch audio recovery, stale refill filtering and fresh AudioContext on Restart.
- Includes the preceding mobile touch/menu, editor and navigation improvements.
- Reorganizes installation documentation around the current PWA instead of the historical IPA experiment.

This release presentation does not modify gameplay or runtime files.

### Known Issues

- Earlier native KHUX popup tap-through, dismissal and stacked-dimming reports still need explicit confirmation on the release build.
- A first normal tap may be needed to restore audio after returning from another app.
- Uncached game data requires internet access; browser storage can be removed.
- Device-specific iOS/WebKit behavior remains a public-beta testing area. Report new issues on [Discord](https://discord.gg/jHWEkRdjJb).

Runtime baseline: [`9e06b47b578c245a00b222977f0edc61358266f4`](https://github.com/qqCLUTCHYqq/cross-road-ios/commit/9e06b47b578c245a00b222977f0edc61358266f4).

For future releases, add a dated version above this entry using **Added**, **Fixed**, and **Known Issues**. List only verified changes and documented limitations.
