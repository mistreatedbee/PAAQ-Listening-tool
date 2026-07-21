class PAQSession {
  final String id;
  final DateTime startedAt;
  DateTime? endedAt;

  PAQSession({required this.id}) : startedAt = DateTime.now();

  int get durationSeconds =>
      (endedAt ?? DateTime.now()).difference(startedAt).inSeconds;

  void end() => endedAt = DateTime.now();
}
