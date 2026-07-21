import 'dart:async';
import 'models/event.dart';
import 'api_client.dart';
import 'config.dart';

/// Batches events and flushes them to the API on a timer or when the
/// queue reaches [ListeningConfig.maxQueueSize].
class EventQueue {
  final ApiClient _client;
  final ListeningConfig _config;

  final List<PAQEvent> _queue = [];
  Timer? _timer;

  EventQueue(this._client, this._config);

  void start() {
    _timer = Timer.periodic(
      Duration(seconds: _config.flushInterval),
      (_) => flush(),
    );
  }

  void enqueue(PAQEvent event) {
    _queue.add(event);
    if (_queue.length >= _config.maxQueueSize) flush();
  }

  Future<void> flush() async {
    if (_queue.isEmpty) return;
    final batch = List<PAQEvent>.from(_queue);
    _queue.clear();
    final success = await _client.postEvents(
      batch.map((e) => e.toJson()).toList(),
    );
    if (!success) {
      // Re-queue on failure (best-effort, bounded by maxQueueSize)
      final space = _config.maxQueueSize - _queue.length;
      if (space > 0) {
        _queue.insertAll(0, batch.take(space));
      }
    }
  }

  void dispose() {
    _timer?.cancel();
    flush();
  }
}
