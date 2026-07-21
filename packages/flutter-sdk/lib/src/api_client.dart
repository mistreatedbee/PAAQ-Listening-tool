import 'dart:convert';
import 'package:http/http.dart' as http;
import 'config.dart';

class ApiClient {
  final ListeningConfig config;

  ApiClient(this.config);

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      };

  Future<bool> postEvents(List<Map<String, dynamic>> events) =>
      _post('events', events);

  Future<bool> postError(Map<String, dynamic> error) =>
      _post('errors', error);

  Future<String?> startSession(Map<String, dynamic> payload) async {
    try {
      final res = await http.post(
        Uri.parse('${config.baseUrl}/sessions'),
        headers: _headers,
        body: jsonEncode({...payload, 'action': 'start'}),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        return data['session_id'] as String?;
      }
    } catch (_) {}
    return null;
  }

  Future<bool> endSession(String sessionId, int durationSeconds) =>
      _post('sessions', {
        'action': 'end',
        'session_id': sessionId,
        'duration': durationSeconds,
      });

  Future<bool> postPerformance(List<Map<String, dynamic>> metrics) =>
      _post('performance', metrics);

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
