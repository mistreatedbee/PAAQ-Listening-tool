## 1.0.0

- Initial release of PAAQ Intelligence Android SDK
- `PAAQ.initialize(context, sdkToken, projectId)` — sdk-init handshake with PAAQ backend
- `PAAQ.track()`, `PAAQ.screen()`, `PAAQ.identify()`, `PAAQ.captureException()` event methods
- Kotlin Coroutines-based async flush and heartbeat
- Stable per-install device ID via SharedPreferences
- Thread-safe synchronized event queue
- 5-minute heartbeat to keep Connection Status active
- Minimum Android API 21 (Android 5.0)
