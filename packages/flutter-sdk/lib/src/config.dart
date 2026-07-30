class PaaqConfig {
  final String sdkToken;
  final String projectId;
  final String baseUrl;
  final int flushInterval; // seconds between batch uploads
  final int heartbeatInterval; // seconds between liveness pings
  final int maxQueueSize;
  final bool debug;

  const PaaqConfig({
    required this.sdkToken,
    required this.projectId,
    this.baseUrl = 'https://mookyonwpovxscsbqwwl.supabase.co/functions/v1',
    this.flushInterval = 30,
    this.heartbeatInterval = 300,
    this.maxQueueSize = 500,
    this.debug = false,
  });
}
