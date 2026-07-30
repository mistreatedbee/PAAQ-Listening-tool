## 1.0.0

- Initial release of `PaaqIntelligence` Swift SDK
- `PAAQ.initialize(sdkToken:projectId:)` — sdk-init handshake with PAAQ backend
- `PAAQ.track()`, `PAAQ.screen()`, `PAAQ.identify()`, `PAAQ.captureError()` event methods
- Automatic flush on `UIApplication.willResignActiveNotification`
- Actor-based thread-safe event queue with no external dependencies
- Stable per-install device ID via UserDefaults
- 5-minute heartbeat to keep Connection Status active
- Supports iOS 15+, macOS 12+, tvOS 15+, watchOS 8+
