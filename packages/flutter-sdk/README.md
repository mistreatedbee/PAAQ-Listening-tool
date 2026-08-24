# paaq_intelligence

The official Flutter SDK for [PAAQ Intelligence](https://paaq.io) — automatic session tracking, error capture, screen analytics, real-time performance monitoring, and visual session replay for Flutter apps.

## Installation

```yaml
dependencies:
  paaq_intelligence: ^0.1.0
```

## Quick start

```dart
import 'package:paaq_intelligence/paaq_intelligence.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await PAAQ.initialize(
    sdkToken: 'sdk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    projectId: 'proj_xxxxxxxx',
  );

  runApp(const MyApp());
}
```

## Usage

```dart
// Track a custom event
PAAQ.track('purchase_completed', {'amount': 49.99, 'currency': 'USD'});

// Record a screen view
PAAQ.screen('CheckoutScreen');

// Identify the current user
PAAQ.identify('user_123', email: 'user@example.com');

// Manually capture an exception
try {
  // ...
} catch (e, stack) {
  PAAQ.captureException(e, stack: stack);
}

// Flush before app close
await PAAQ.flush();

// End the session explicitly (e.g. on logout)
await PAAQ.endSessionOnLogout();

// Dispose the SDK (deliberate teardown)
await PAAQ.dispose();
```

## Navigation (auto screen tracking)

Register `PaaqNavigatorObserver` so `PAAQ.screen()` fires automatically on route
changes instead of you calling it manually:

```dart
runApp(
  MaterialApp(
    navigatorObservers: [PaaqNavigatorObserver()],
    home: const HomeScreen(),
  ),
);
```

## Scroll depth (opt-in)

Wrap any scrollable you want measured — Flutter has no app-wide scroll hook:

```dart
PaaqScrollTracker(child: ListView(...))
```

## Visual session replay (opt-in)

Wrap your app root with `PaaqScreenshotBoundary` to enable screenshot-based
session replay (paused automatically while a form field is focused):

```dart
runApp(
  PaaqScreenshotBoundary(child: MaterialApp(...)),
);
```

Touch tracking (rage/dead-tap detection) is installed automatically by
`initialize()` and needs no opt-in.

## Features

- Real session lifecycle tracking (start on init, end on dispose)
- Automatic Flutter error and unhandled exception capture
- Rage/dead-tap detection (installed automatically)
- Batched event uploads with configurable flush interval
- Stable per-install device ID (persisted across relaunches)
- Automatic 5-minute heartbeat so your dashboard shows "connected" without needing a relaunch
- Auto screen tracking via `PaaqNavigatorObserver`
- Opt-in scroll-depth tracking via `PaaqScrollTracker`
- Opt-in screenshot-based visual session replay via `PaaqScreenshotBoundary`