import 'config.dart';
import 'api_client.dart';
import 'event_queue.dart';
import 'error_tracker.dart';
import 'device_info.dart';
import 'models/event.dart';
import 'models/session.dart';

/// Entry point for the PAAQ Listening SDK.
///
/// Usage:
/// ```dart
/// await Listening.initialize(
///   apiKey: 'your_api_key',
///   projectId: 'your_project_id',
/// );
/// ```
class Listening {
  static Listening? _instance;

  final ListeningConfig _config;
  final ApiClient _api;
  final EventQueue _queue;
  final ErrorTracker _errors;

  String? _userId;
  PAQSession? _session;

  Listening._(this._config)
      : _api = ApiClient(_config),
        _queue = EventQueue(ApiClient(_config), _config),
        _errors = ErrorTracker(ApiClient(_config));

  /// Initialize the SDK. Call once at app startup before runApp().
  static Future<void> initialize({
    required String apiKey,
    required String projectId,
    String? baseUrl,
    bool debug = false,
  }) async {
    final config = ListeningConfig(
      apiKey: apiKey,
      projectId: projectId,
      baseUrl: baseUrl ?? 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1',
      debug: debug,
    );

    _instance = Listening._(config);
    _instance!._errors.install();
    _instance!._queue.start();

    // Start a session automatically on initialize.
    await _instance!._startSession();
  }

  static Listening get _i {
    assert(_instance != null, 'Call Listening.initialize() before using the SDK.');
    return _instance!;
  }

  /// Identify the current user.
  static void identify(String userId, {String? email}) {
    _i._userId = userId;
    _i._errors.setUser(userId);
    _i._track(PAQEvent(
      name: 'user_identified',
      category: 'auth',
      properties: {
        'user_id': userId,
        if (email != null) 'email': email,
      },
    ));
  }

  /// Track a custom event.
  static void track(String eventName, [Map<String, dynamic> properties = const {}]) {
    _i._track(PAQEvent(
      name: eventName,
      properties: properties,
      screen: _i._errors._currentScreen,
      userId: _i._userId,
      sessionId: _i._session?.id,
    ));
  }

  /// Record the current screen name.
  static void screen(String name) {
    _i._errors.setScreen(name);
    _i._track(PAQEvent(
      name: 'screen_view',
      category: 'navigation',
      screen: name,
      userId: _i._userId,
      sessionId: _i._session?.id,
    ));
  }

  /// Manually capture an exception.
  static void captureException(Object error, {StackTrace? stack}) {
    _i._errors.captureException(error, stack: stack);
  }

  /// Flush the event queue immediately (e.g. before app close).
  static Future<void> flush() => _i._queue.flush();

  /// Dispose the SDK (call in app lifecycle onDetach).
  static Future<void> dispose() async {
    await _i._endSession();
    _i._queue.dispose();
  }

  // ── Internal ──────────────────────────────────────────────

  void _track(PAQEvent event) => _queue.enqueue(event);

  Future<void> _startSession() async {
    final deviceInfo = await DeviceInfoCollector.collect();
    final sessionId = await _api.startSession({
      'user_id': _userId,
      ...deviceInfo.map((k, v) => MapEntry(k, v ?? '')),
    });
    if (sessionId != null) {
      _session = PAQSession(id: sessionId);
      _errors.setSession(sessionId);
    }
  }

  Future<void> _endSession() async {
    final s = _session;
    if (s == null) return;
    s.end();
    await _api.endSession(s.id, s.durationSeconds);
    _session = null;
  }
}
