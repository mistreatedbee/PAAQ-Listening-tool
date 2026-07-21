import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

class ListeningClient {
  static const String _baseUrl =
      'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1';
  static const String _anonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vb2t5b253cG92eHNjc2Jxd3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MjU0MjgsImV4cCI6MjEwMDIwMTQyOH0.Eik5AQVxSw0w9nHUUdC3dfxhCA6jWoC-SOOqsCbJSSU';

  final String apiKey;

  ListeningClient({required this.apiKey});

  Map<String, String> get _headers => {
        'Authorization': 'Bearer $_anonKey',
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      };

  /// Fire-and-forget POST — never throws, never blocks the caller.
  void send(String endpoint, Map<String, dynamic> body) {
    http
        .post(
          Uri.parse('$_baseUrl/$endpoint'),
          headers: _headers,
          body: jsonEncode(body),
        )
        .catchError((_) {});
  }

  /// POST with response — used when we need the returned data (e.g. session_id).
  Future<Map<String, dynamic>?> sendWithResponse(
    String endpoint,
    Map<String, dynamic> body,
  ) async {
    try {
      final res = await http.post(
        Uri.parse('$_baseUrl/$endpoint'),
        headers: _headers,
        body: jsonEncode(body),
      );
      return jsonDecode(res.body) as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
  }
}
