## 1.0.0

- Initial release of `@paaq/react-native-sdk`
- `PAAQ.initialize(sdkToken, projectId)` — sdk-init handshake with PAAQ backend
- `PAAQ.track()`, `PAAQ.screen()`, `PAAQ.identify()` event methods
- Automatic flush when app transitions to background (AppState listener)
- Stable per-install device ID via AsyncStorage
- 5-minute heartbeat to keep Connection Status active
- Works with React Native 0.68+ and all Expo SDK versions
