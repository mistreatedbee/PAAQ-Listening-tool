import 'package:flutter/foundation.dart';
import 'api_client.dart';

class ErrorTracker {
  final ApiClient _client;
  String? _currentScreen;
  String? _currentUserId;
  String? _currentSessionId;

  ErrorTracker(this._client);

  void install() {
    FlutterError.onError = (FlutterErrorDetails details) {
      _capture(
        type: details.exception.runtimeType.toString(),
        message: details.exceptionAsString(),
        stack: details.stack?.toString(),
        severity: 'error',
      );
      // Also pass to the default handler so errors appear in console.
      FlutterError.presentError(details);
    };

    PlatformDispatcher.instance.onError = (error, stack) {
      _capture(
        type: error.runtimeType.toString(),
        message: error.toString(),
        stack: stack.toString(),
        severity: 'fatal',
      );
      return false; // Let the platform handle it.
    };
  }

  void setScreen(String screen) => _currentScreen = screen;
  void setUser(String? userId) => _currentUserId = userId;
  void setSession(String? sessionId) => _currentSessionId = sessionId;

  void captureException(Object error, {StackTrace? stack, String severity = 'error'}) {
    _capture(
      type: error.runtimeType.toString(),
      message: error.toString(),
      stack: stack?.toString(),
      severity: severity,
    );
  }

  void _capture({
    required String type,
    required String message,
    String? stack,
    required String severity,
  }) {
    _client.postError({
      'error_type': type,
      'message': message,
      if (stack != null) 'stack_trace': stack,
      if (_currentScreen != null) 'screen': _currentScreen,
      if (_currentUserId != null) 'user_id': _currentUserId,
      if (_currentSessionId != null) 'session_id': _currentSessionId,
      'severity': severity,
    });
  }
}
