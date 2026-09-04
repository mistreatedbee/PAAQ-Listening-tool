# @paaq/web-sdk Changelog

## 1.2.9 — 2026-09-04

### Fixed
- Session recording replay glitches: flush only on FullSnapshot (type 2), not Meta events.
- Chronological event ordering and chunk sequencing for faithful playback.
- Mouse sampling at 16ms with inline styles/fonts/canvas capture.
- Serialized flush queue with buffer restore on failed upload.
- Error capture: immediate flush plus ~5s post-error window before session end.

### Changed
- `skipInactive: false` for more complete replays.
- Recording checkout extended to 3 minutes for long sessions.

## 1.2.8 — 2026-09-03

### Added
- Performance monitoring flush on heartbeat and session events.
- `trackError` triggers immediate recording + event flush.

## 1.2.7 — 2026-09-02

### Added
- Pre-error recording buffer (~20–30s) retained on uncaught errors.
- `endSession` flushes pending events and recording chunks.

## 1.2.6 — 2026-08-28

### Added
- DOM session recording via rrweb with privacy defaults (`maskAllInputs`, `paaq-block` / `paaq-mask`).
- Performance monitoring hooks after init.
