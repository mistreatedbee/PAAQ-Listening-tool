## 0.1.0

- Initial release of `paaq_intelligence` Flutter SDK
- `PAAQ.initialize(sdkToken, projectId)` — real sdk-init handshake with PAAQ backend
- Automatic session tracking and error capture (Flutter + PlatformDispatcher)
- `PAAQ.track()`, `PAAQ.screen()`, `PAAQ.identify()` event methods
- Automatic 5-minute heartbeat keeps Connection Status green while app is running
- Stable per-install device ID persisted via SharedPreferences
- Batched event queue with configurable flush interval
