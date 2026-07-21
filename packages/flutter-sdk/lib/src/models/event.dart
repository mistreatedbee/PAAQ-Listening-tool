class PAQEvent {
  final String name;
  final String? category;
  final String? screen;
  final Map<String, dynamic> properties;
  final DateTime timestamp;
  final String? userId;
  final String? sessionId;

  PAQEvent({
    required this.name,
    this.category,
    this.screen,
    this.properties = const {},
    DateTime? timestamp,
    this.userId,
    this.sessionId,
  }) : timestamp = timestamp ?? DateTime.now();

  Map<String, dynamic> toJson() => {
        'event_name': name,
        if (category != null) 'event_category': category,
        if (screen != null) 'screen_name': screen,
        'properties': properties,
        'timestamp': timestamp.toIso8601String(),
        if (userId != null) 'user_id': userId,
        if (sessionId != null) 'session_id': sessionId,
      };
}
