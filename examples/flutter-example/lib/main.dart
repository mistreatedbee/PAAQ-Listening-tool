import 'package:flutter/material.dart';
import 'package:paaq_listening_sdk/paaq_listening_sdk.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Initialize the SDK before runApp.
  await Listening.initialize(
    apiKey: 'YOUR_API_KEY',     // replace with your project API key
    projectId: 'YOUR_PROJECT_ID',
    debug: true,                // set false in production
  );

  runApp(const ExampleApp());
}

class ExampleApp extends StatelessWidget {
  const ExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PAAQ SDK Example',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _eventCount = 0;

  @override
  void initState() {
    super.initState();
    // Record the screen view.
    Listening.screen('Home');

    // Identify the user (call this after login).
    Listening.identify('demo_user_001', email: 'demo@paaq.app');
  }

  void _trackButtonTap() {
    setState(() => _eventCount++);
    Listening.track('button_click', {
      'button': 'send_event',
      'count': _eventCount,
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Event #$_eventCount sent to PAAQ')),
    );
  }

  void _triggerError() {
    try {
      throw Exception('Demo error from PAAQ example app');
    } catch (e, stack) {
      Listening.captureException(e, stack: stack);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Error captured and sent to PAAQ')),
      );
    }
  }

  void _navigateToSecondScreen() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const SecondScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('PAAQ SDK Demo')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Events sent:', style: TextStyle(fontSize: 16)),
            Text('$_eventCount', style: Theme.of(context).textTheme.displayMedium),
            const SizedBox(height: 32),
            FilledButton.icon(
              onPressed: _trackButtonTap,
              icon: const Icon(Icons.send),
              label: const Text('Send Event'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _triggerError,
              icon: const Icon(Icons.error_outline),
              label: const Text('Capture Error'),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: _navigateToSecondScreen,
              icon: const Icon(Icons.navigate_next),
              label: const Text('Go to Second Screen'),
            ),
            const SizedBox(height: 32),
            FilledButton.tonal(
              onPressed: () => Listening.flush(),
              child: const Text('Flush Queue Now'),
            ),
          ],
        ),
      ),
    );
  }
}

class SecondScreen extends StatefulWidget {
  const SecondScreen({super.key});
  @override
  State<SecondScreen> createState() => _SecondScreenState();
}

class _SecondScreenState extends State<SecondScreen> {
  @override
  void initState() {
    super.initState();
    Listening.screen('SecondScreen');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Second Screen')),
      body: const Center(
        child: Text('Screen view tracked automatically.'),
      ),
    );
  }
}
