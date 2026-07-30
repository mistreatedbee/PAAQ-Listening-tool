import 'dart:convert';
import 'package:http/http.dart' as http;
import 'config.dart';

const _sdkVersion = '1.0.0';

class InitResult {
  final bool ok;
  final String? sessionId;
  final String? error;

  InitResult({required this.ok, this.sessionId, this.error});
}

class ApiClient {
  final PaaqConfig config;

  ApiClient(this.config);

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${config.sdkToken}',
        'X-Project-ID': config.projectId,
        'X-SDK-Version': _sdkVersion,
        'X-Platform': 'flutter',
        'X-Environment': config.debug ? 'development' : 'production',
      };

  /// Real handshake with the backend — registers this install in
  /// sdk_installations and opens a session row, same contract every
  /// other PAAQ SDK (web, server) uses.
  Future<InitResult> initHandshake(String deviceId) async {
    try {
      final res = await http.post(
        Uri.parse('${config.baseUrl}/sdk-init'),
        headers: _headers,
        body: jsonEncode({'deviceId': deviceId}),
      );
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode == 200 && data['ok'] == true) {
        return InitResult(ok: true, sessionId: data['sessionId'] as String?);
      }
      return InitResult(ok: false, error: data['error'] as String?);
    } catch (e) {
      return InitResult(ok: false, error: e.toString());
    }
  }

  /// Genuine periodic liveness ping — only advances last_seen while this
  /// process is actually running, no synthetic timer server-side.
  Future<void> heartbeat(String deviceId) async {
    try {
      await http.post(
        Uri.parse('${config.baseUrl}/sdk-heartbeat'),
        headers: _headers,
        body: jsonEncode({'deviceId': deviceId}),
      );
    } catch (_) {
      // Fire-and-forget — a missed heartbeat just leaves last_seen stale
      // until the next one succeeds.
    }
  }

  Future<bool> postEvents(List<Map<String, dynamic>> events) =>
      _post('events', events);

  Future<bool> postError(Map<String, dynamic> error) =>
      _post('errors', [error]);

  Future<bool> endSession(String sessionId, int durationSeconds) =>
      _post('sessions', {
        'action': 'end',
        'session_id': sessionId,
        'duration': durationSeconds,
      });

  Future<bool> _post(String endpoint, dynamic body) async {
    try {
      final res = await http.post(
        Uri.parse('${config.baseUrl}/$endpoint'),
        headers: _headers,
        body: jsonEncode(body),
      );
      if (config.debug) {
        // ignore: avoid_print
        print('[PAAQ] POST $endpoint → ${res.statusCode}');
      }
      return res.statusCode == 200;
    } catch (e) {
      if (config.debug) {
        // ignore: avoid_print
        print('[PAAQ] POST $endpoint failed: $e');
      }
      return false;
    }
  }
}
