# PAAQ Listening SDK — Flutter Integration Guide

## 1. Add the dependency

In your Flutter app's `pubspec.yaml`:

```yaml
dependencies:
  paaq_listening:
    git:
      url: https://github.com/mistreatedbee/PAAQ-Listening-tool.git
      path: apps/sdk
```

Then run:
```bash
flutter pub get
```

## 2. Initialise (one line)

In your `main.dart`, before `runApp`:

```dart
import 'package:paaq_listening/listening.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Listening.init(apiKey: 'paaq_live_key_001');
  runApp(const MyApp());
}
```

That's it. The SDK automatically:
- Starts a session
- Captures all uncaught Flutter errors
- Captures unhandled async errors

## 3. Track events

```dart
Listening.trackEvent('purchase_completed',
  screen: 'CheckoutScreen',
  category: 'commerce',
  properties: {'amount': 49.99, 'currency': 'USD'},
);
```

## 4. Track screen views

```dart
// Manual
Listening.trackScreen('ProfileScreen');

// Automatic via NavigatorObserver (add to MaterialApp)
navigatorObservers: [ListeningNavigatorObserver()],
```

## 5. Track errors (handled exceptions)

```dart
try {
  await riskyOperation();
} catch (e, stack) {
  Listening.trackError(e,
    stackTrace: stack,
    screen: 'PaymentScreen',
    severity: ErrorSeverity.error,
  );
}
```

Severity levels: `info`, `warning`, `error`, `fatal`

Unhandled errors are captured automatically — no extra code needed.

## 6. Identify users (after login)

```dart
await Listening.identify(
  userId: authUser.id,   // your auth system's user ID (must be a UUID)
  email: authUser.email,
);
```

Call `Listening.logout()` when the user signs out.

## 7. Track performance

```dart
final sw = Stopwatch()..start();
await loadDashboardData();
Listening.trackPerformance('dashboard_load_time', sw.elapsedMilliseconds.toDouble());
```

## API endpoints (for non-Flutter apps)

All requests require two headers:
```
Authorization: Bearer <supabase-anon-key>
x-api-key: paaq_live_key_001
```

| Endpoint | Method | Purpose |
|---|---|---|
| `/functions/v1/events` | POST | Track events |
| `/functions/v1/errors` | POST | Report errors |
| `/functions/v1/sessions` | POST | Start/end sessions |
| `/functions/v1/performance` | POST | Record metrics |
