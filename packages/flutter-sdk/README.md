# paaq_intelligence

The official Flutter SDK for [PAAQ Intelligence](https://paaq.io) — automatic session tracking, error capture, screen analytics, and real-time performance monitoring for Flutter apps.

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

// Dispose on shutdown
await PAAQ.dispose();
```

## Features

- Real session lifecycle tracking (start on init, end on dispose)
- Automatic Flutter error and unhandled exception capture
- Batched event uploads with configurable flush interval
- Stable per-install device ID (persisted across relaunches)
- Automatic 5-minute heartbeat so your dashboard shows "connected" without needing a relaunch
