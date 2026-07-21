library paaq_listening;

import 'dart:ui';
import 'package:flutter/widgets.dart';
import 'src/client.dart';

/// Severity levels for error tracking.
enum ErrorSeverity { info, warning, error, fatal }

/// PAAQ Listening SDK.
///
/// Call [Listening.init] once in [main] before [runApp].
/// All other methods are safe to call from anywhere — they never throw.
///
/// ```dart
/// void main() async {
///   WidgetsFlutterBinding.ensureInitialized();
///   await Listening.init(apiKey: 'paaq_live_key_001');
///   runApp(const MyApp());
/// }
/// ```
class Listening {
  Listening._();

  static ListeningClient? _client;
  static String? _sessionId;
  static DateTime? _sessionStart;

  // ─── Initialisation ──────────────────────────────────────────────────────

  /// Initialise the SDK. Must be called before any other method.
  ///
  /// Starts a session automatically and wires up Flutter's error handler
  /// so uncaught exceptions are captured without any extra setup.
  static Future<void> init({required String apiKey}) async {
    _client = ListeningClient(apiKey: apiKey);

    // Capture Flutter framework errors automatically.
    FlutterError.onError = (details) {
      trackError(
        details.exception,
        stackTrace: details.stack,
        severity: ErrorSeverity.fatal,
      );
    };

    // Capture errors outside of Flutter's framework (e.g. async gaps).
    PlatformDispatcher.instance.onError = (error, stack) {
      trackError(error, stackTrace: stack, severity: ErrorSeverity.fatal);
      return false;
    };

    await _startSession();
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  /// Track any named event.
  ///
  /// ```dart
  /// Listening.trackEvent('purchase_completed',
  ///   screen: 'CheckoutScreen',
  ///   category: 'commerce',
  ///   properties: {'amount': 49.99, 'currency': 'USD'},
  /// );
  /// ```
  static void trackEvent(
    String name, {
    String? screen,
    String? category,
    Map<String, dynamic>? properties,
  }) {
    _client?.send('events', {
      'event_name': name,
      if (screen != null) 'screen_name': screen,
      if (category != null) 'event_category': category,
      if (_sessionId != null) 'session_id': _sessionId,
      'properties': properties ?? {},
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  /// Track a screen view. Shorthand for [trackEvent] with category 'navigation'.
  static void trackScreen(String screenName) {
    trackEvent('screen_view', screen: screenName, category: 'navigation');
  }

  // ─── Errors ───────────────────────────────────────────────────────────────

  /// Capture an error or exception.
  ///
  /// ```dart
  /// try {
  ///   await someRiskyCall();
  /// } catch (e, stack) {
  ///   Listening.trackError(e, stackTrace: stack, screen: 'PaymentScreen');
  /// }
  /// ```
  static void trackError(
    dynamic error, {
    StackTrace? stackTrace,
    String? screen,
    ErrorSeverity severity = ErrorSeverity.error,
  }) {
    _client?.send('errors', {
      'error_type': error.runtimeType.toString(),
      'message': error.toString(),
      if (stackTrace != null) 'stack_trace': stackTrace.toString(),
      if (screen != null) 'screen': screen,
      'severity': severity.name,
      'status': 'open',
    });
  }

  // ─── Sessions ────────────────────────────────────────────────────────────

  /// Call when the user is identified (e.g. after login).
  ///
  /// Ends the anonymous session and starts a new one tied to this user.
  ///
  /// ```dart
  /// await Listening.identify(userId: user.id, email: user.email);
  /// ```
  static Future<void> identify({
    required String userId,
    String? email,
  }) async {
    // End the current anonymous session first.
    await _endSession();
    // Start a new session tied to this user.
    await _startSession(userId: userId);
    trackEvent('user_identified', category: 'auth');
  }

  /// Call on logout to end the identified session and start a fresh anonymous one.
  static Future<void> logout() async {
    await _endSession();
    await _startSession();
    trackEvent('user_logged_out', category: 'auth');
  }

  // ─── Performance ─────────────────────────────────────────────────────────

  /// Record a performance measurement.
  ///
  /// ```dart
  /// final sw = Stopwatch()..start();
  /// await loadDashboard();
  /// Listening.trackPerformance('dashboard_load_time', sw.elapsedMilliseconds.toDouble());
  /// ```
  static void trackPerformance(String metricType, double value) {
    _client?.send('performance', {
      'metric_type': metricType,
      'value': value,
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  static Future<void> _startSession({String? userId}) async {
    _sessionStart = DateTime.now();
    final res = await _client?.sendWithResponse('sessions', {
      'action': 'start',
      if (userId != null) 'user_id': userId,
    });
    _sessionId = res?['session_id'] as String?;
  }

  static Future<void> _endSession() async {
    if (_sessionId == null) return;
    final duration = _sessionStart != null
        ? DateTime.now().difference(_sessionStart!).inSeconds
        : null;
    await _client?.sendWithResponse('sessions', {
      'action': 'end',
      'session_id': _sessionId,
      if (duration != null) 'duration': duration,
    });
    _sessionId = null;
    _sessionStart = null;
  }
}
