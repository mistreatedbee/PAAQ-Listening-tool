import 'dart:async';
import 'config.dart';
import 'api_client.dart';
import 'event_queue.dart';
import 'error_tracker.dart';
import 'device_info.dart';
import 'models/event.dart';
import 'models/session.dart';

/// Entry point for the PAAQ Intelligence SDK.
///
/// Usage:
/// ```dart
/// await PAAQ.initialize(
///   sdkToken: 'sdk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
///   projectId: 'proj_xxxxxxxx',
/// );
/// ```
class PAAQ {
  static PAAQ? _instance;

  final PaaqConfig _config;
  final ApiClient _api;
  final EventQueue _queue;
  final ErrorTracker _errors;

  String? _userId;
  String _deviceId = '';
  PAQSession? _session;
  Timer? _heartbeatTimer;

  PAAQ._(this._config)
      : _api = ApiClient(_config),
        _queue = EventQueue(ApiClient(_config), _config),
        _errors = ErrorTracker(ApiClient(_config));

  /// Initialize the SDK. Call once at app startup before runApp().
  static Future<void> initialize({
    required String sdkToken,
    required String projectId,
    String? baseUrl,
    bool debug = false,
  }) async {
    final config = PaaqConfig(
      sdkToken: sdkToken,
      projectId: projectId,
      baseUrl: baseUrl ?? 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1',
      debug: debug,
    );

    _instance = PAAQ._(config);
    _instance!._errors.install();
    _instance!._queue.start();

    await _instance!._startSession();
    _instance!._scheduleHeartbeat();
  }

  static PAAQ get _i {
    assert(_instance != null, 'Call PAAQ.initialize() before using the SDK.');
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
      screen: _i._errors.currentScreen,
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
    _i._heartbeatTimer?.cancel();
    await _i._endSession();
    _i._queue.dispose();
  }

  // ── Internal ──────────────────────────────────────────────

  void _track(PAQEvent event) => _queue.enqueue(event);

  Future<void> _startSession() async {
    _deviceId = await DeviceInfoCollector.deviceId();
    final result = await _api.initHandshake(_deviceId);
    if (result.ok && result.sessionId != null) {
      _session = PAQSession(id: result.sessionId!);
      _errors.setSession(result.sessionId);
    }
  }

  Future<void> _endSession() async {
    final s = _session;
    if (s == null) return;
    s.end();
    await _api.endSession(s.id, s.durationSeconds);
    _session = null;
  }

  void _scheduleHeartbeat() {
    _heartbeatTimer?.cancel();
    // Keeps sdk_installations.last_seen fresh for as long as the app is
    // actually running — no relaunch needed for Connection Status to see
    // this as connected.
    _heartbeatTimer = Timer.periodic(
      Duration(seconds: _config.heartbeatInterval),
      (_) => _api.heartbeat(_deviceId),
    );
  }
}
