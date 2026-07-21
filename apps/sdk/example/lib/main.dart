import 'package:flutter/material.dart';
import 'package:paaq_listening/listening.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ─── PAAQ Listening SDK — one line setup ──────────────────────────────
  await Listening.init(apiKey: 'paaq_live_key_001');
  // ──────────────────────────────────────────────────────────────────────

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PAAQ SDK Example',
      home: const HomeScreen(),
      // Track every screen navigation automatically
      navigatorObservers: [ListeningNavigatorObserver()],
    );
  }
}

// ─── Optional: auto screen tracking via NavigatorObserver ─────────────────

class ListeningNavigatorObserver extends NavigatorObserver {
  @override
  void didPush(Route route, Route? previousRoute) {
    final name = route.settings.name;
    if (name != null) Listening.trackScreen(name);
  }
}

// ─── Example screen showing all SDK methods ───────────────────────────────

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('PAAQ SDK Example')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Track a custom event
          ElevatedButton(
            onPressed: () {
              Listening.trackEvent(
                'button_tap',
                screen: 'HomeScreen',
                category: 'interaction',
                properties: {'button': 'track_event_demo'},
              );
              ScaffoldMessenger.of(context)
                  .showSnackBar(const SnackBar(content: Text('Event tracked')));
            },
            child: const Text('Track Event'),
          ),

          const SizedBox(height: 12),

          // Track a performance metric
          ElevatedButton(
            onPressed: () async {
              final sw = Stopwatch()..start();
              await Future.delayed(const Duration(milliseconds: 200));
              Listening.trackPerformance(
                'demo_operation_time',
                sw.elapsedMilliseconds.toDouble(),
              );
              ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Performance tracked')));
            },
            child: const Text('Track Performance'),
          ),

          const SizedBox(height: 12),

          // Track a handled error
          ElevatedButton(
            onPressed: () {
              try {
                throw Exception('Demo error for testing');
              } catch (e, stack) {
                Listening.trackError(
                  e,
                  stackTrace: stack,
                  screen: 'HomeScreen',
                  severity: ErrorSeverity.warning,
                );
              }
              ScaffoldMessenger.of(context)
                  .showSnackBar(const SnackBar(content: Text('Error tracked')));
            },
            child: const Text('Track Error'),
          ),

          const SizedBox(height: 12),

          // Identify a user after login
          ElevatedButton(
            onPressed: () async {
              await Listening.identify(
                userId: 'user-uuid-from-your-auth-system',
                email: 'user@example.com',
              );
              ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('User identified')));
            },
            child: const Text('Identify User (simulates login)'),
          ),

          const SizedBox(height: 12),

          // Logout
          ElevatedButton(
            onPressed: () async {
              await Listening.logout();
              ScaffoldMessenger.of(context)
                  .showSnackBar(const SnackBar(content: Text('Logged out')));
            },
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}
