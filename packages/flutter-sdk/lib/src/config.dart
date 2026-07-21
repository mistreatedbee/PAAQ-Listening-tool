class ListeningConfig {
  final String apiKey;
  final String projectId;
  final String baseUrl;
  final int flushInterval; // seconds between batch uploads
  final int maxQueueSize;
  final bool debug;

  const ListeningConfig({
    required this.apiKey,
    required this.projectId,
    this.baseUrl = 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1',
    this.flushInterval = 30,
    this.maxQueueSize = 500,
    this.debug = false,
  });
}
