import 'dart:async';
import 'package:flutter/widgets.dart';
import 'config.dart';
import 'api_client.dart';
import 'event_queue.dart';
import 'error_tracker.dart';
import 'device_info.dart';
import 'touch_tracker.dart';
import 'models/event.dart';
import 'models/session.dart';

/// Grace period after backgrounding before a session is considered ended —
/// distinguishes a brief app-switch from the user actually being done.
const _backgroundGracePeriod = Duration(seconds: 30);

/// Entry point for the PAAQ Intelligence SDK.
///
/// Usage:
/// ```dart
/// await PAAQ.initialize(
///   sdkToken: 'sdk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
///   projectId: 'proj_xxxxxxxx',
/// );
/// ```
class PAAQ with WidgetsBindingObserver {
  static PAAQ? _instance;

  final PaaqConfig _config;
  final ApiClient _api;
  final EventQueue _queue;
  final ErrorTracker _errors;

  String? _userId;
  String _deviceId = '';
  PAQSession? _session;
  Timer? _heartbeatTimer;
  Timer? _backgroundGraceTimer;
  bool _explicitDispose = false;
  DateTime _lastSignalAt = DateTime.fromMillisecondsSinceEpoch(0);
  int _maxScrollPct = 0;
  final Set<int> _reportedScrollMilestones = {};
  final Map<String, DateTime> _fieldStartedAt = {};
  final Map<String, int> _fieldBackspaceCounts = {};

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
    _instance!._errors.onFatalError = () => _instance!._endSession(outcome: 'crashed');
    _instance!._errors.install();
    _instance!._queue.start();
    WidgetsBinding.instance.addObserver(_instance!);

    await _instance!._startSession();
    _instance!._scheduleHeartbeat();
    _instance!._installTouchTracking();
  }

  void _installTouchTracking() {
    PaaqTouchTracker(
      onRageTap: (x, y, count) => _track(PAQEvent(
        name: '\$rage_click',
        properties: {'x': x, 'y': y, 'tapCount': count},
        userId: _userId,
        sessionId: _session?.id,
      )),
      onDeadTap: (x, y) => _track(PAQEvent(
        name: '\$dead_click',
        properties: {'x': x, 'y': y},
        userId: _userId,
        sessionId: _session?.id,
      )),
      lastSignalAt: () => _lastSignalAt,
    ).install();
  }

  /// Call from a scroll listener (or wrap a scrollable in PaaqScrollTracker) with 0-100.
  static void trackScrollDepth(int pct) => _i._trackScrollDepth(pct);

  void _trackScrollDepth(int pct) {
    if (pct <= _maxScrollPct) return;
    _maxScrollPct = pct;
    for (final milestone in [25, 50, 75, 100]) {
      if (pct >= milestone && _reportedScrollMilestones.add(milestone)) {
        track('\$scroll_depth', {'pct': milestone});
      }
    }
  }

  /// Call when navigating to a new screen so scroll depth is measured per screen.
  static void resetScrollTracking() {
    _i._maxScrollPct = 0;
    _i._reportedScrollMilestones.clear();
  }

  static void trackFieldFocus(String fieldName) {
    _i._fieldStartedAt[fieldName] = DateTime.now();
    _i._fieldBackspaceCounts[fieldName] = 0;
  }

  static void trackFieldBackspace(String fieldName) {
    _i._fieldBackspaceCounts[fieldName] = (_i._fieldBackspaceCounts[fieldName] ?? 0) + 1;
  }

  static void trackFieldBlur(
    String fieldName, {
    String? formName,
    bool hadError = false,
    bool completed = false,
  }) {
    final startedAt = _i._fieldStartedAt.remove(fieldName);
    final backspaces = _i._fieldBackspaceCounts.remove(fieldName) ?? 0;
    track('\$form_field', {
      'fieldName': fieldName,
      'formName': formName ?? '',
      'timeSpentMs': startedAt != null ? DateTime.now().difference(startedAt).inMilliseconds : 0,
      'backspaceCount': backspaces,
      'hadError': hadError,
      'completed': completed,
    });
  }

  static void trackFormAbandon(String formName) {
    track('\$form_abandon', {'formName': formName});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      _backgroundGraceTimer?.cancel();
      _backgroundGraceTimer = Timer(_backgroundGracePeriod, () {
        _endSession(outcome: 'completed');
      });
    } else if (state == AppLifecycleState.resumed) {
      _backgroundGraceTimer?.cancel();
    } else if (state == AppLifecycleState.detached) {
      // Real app termination — if dispose() wasn't called explicitly first,
      // this wasn't a deliberate teardown.
      if (!_explicitDispose) {
        _endSession(outcome: 'force_closed');
      }
    }
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

  /// Dispose the SDK (call explicitly when the app is deliberately tearing
  /// down PAAQ, e.g. sign-out). A deliberate call here means a later
  /// AppLifecycleState.detached is not treated as a force-close.
  static Future<void> dispose() async {
    _i._explicitDispose = true;
    _i._backgroundGraceTimer?.cancel();
    _i._heartbeatTimer?.cancel();
    WidgetsBinding.instance.removeObserver(_i);
    await _i._endSession(outcome: 'completed');
    _i._queue.dispose();
  }

  /// End the current session because the host app knows the user logged out
  /// — the SDK cannot infer this on its own.
  static Future<void> endSessionOnLogout() => _i._endSession(outcome: 'logged_out');

  // ── Internal ──────────────────────────────────────────────

  void _track(PAQEvent event) {
    _lastSignalAt = DateTime.now();
    _queue.enqueue(event);
  }

  Future<void> _startSession() async {
    _deviceId = await DeviceInfoCollector.deviceId();
    final deviceMetadata = await DeviceInfoCollector.collect();
    final result = await _api.initHandshake(_deviceId, deviceMetadata: deviceMetadata);
    if (result.ok && result.sessionId != null) {
      _session = PAQSession(id: result.sessionId!);
      _errors.setSession(result.sessionId);
    }
  }

  Future<void> _endSession({required String outcome}) async {
    final s = _session;
    if (s == null) return;
    s.end();
    _session = null; // clear first — guards against a race with a second lifecycle callback
    await _api.endSession(s.id, s.durationSeconds, outcome);
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
