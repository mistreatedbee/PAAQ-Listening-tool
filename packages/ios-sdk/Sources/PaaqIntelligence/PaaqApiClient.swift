import Foundation

private let baseURL = "https://mookyonwpovxscsbqwwl.supabase.co/functions/v1"
private let sdkVersion = "1.0.0"

actor PaaqApiClient {
    private let config: PaaqConfig
    private let deviceId: String
    private let session: URLSession

    init(config: PaaqConfig, deviceId: String) {
        self.config = config
        self.deviceId = deviceId
        let sessionConfig = URLSessionConfiguration.default
        sessionConfig.timeoutIntervalForRequest = 10
        self.session = URLSession(configuration: sessionConfig)
    }

    private var headers: [String: String] {
        [
            "Content-Type": "application/json",
            "Authorization": "Bearer \(config.sdkToken)",
            "X-Project-ID": config.projectId,
            "X-SDK-Version": sdkVersion,
            "X-Platform": "ios",
            "X-Environment": config.environment,
        ]
    }

    func sdkInit() async throws -> (sessionId: String?, serverBatchSize: Int?, serverFlushInterval: TimeInterval?) {
        var req = URLRequest(url: URL(string: "\(baseURL)/sdk-init")!)
        req.httpMethod = "POST"
        headers.forEach { req.setValue($1, forHTTPHeaderField: $0) }
        req.httpBody = try JSONEncoder().encode(["deviceId": deviceId])

        let (data, _) = try await session.data(for: req)
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        let sessionId = json["sessionId"] as? String
        let cfg = json["config"] as? [String: Any]
        let batchSize = cfg?["batchSize"] as? Int
        let flushSecs = (cfg?["syncIntervalSeconds"] as? Double).map { $0 }
        return (sessionId, batchSize, flushSecs)
    }

    func flush(events: [PaaqEvent]) async {
        guard !events.isEmpty else { return }
        do {
            var req = URLRequest(url: URL(string: "\(baseURL)/events")!)
            req.httpMethod = "POST"
            headers.forEach { req.setValue($1, forHTTPHeaderField: $0) }
            req.httpBody = try JSONEncoder().encode(events)
            _ = try await session.data(for: req)
        } catch {
            // fire-and-forget
        }
    }

    func heartbeat() async {
        do {
            var req = URLRequest(url: URL(string: "\(baseURL)/sdk-heartbeat")!)
            req.httpMethod = "POST"
            headers.forEach { req.setValue($1, forHTTPHeaderField: $0) }
            req.httpBody = try JSONEncoder().encode(["deviceId": deviceId])
            _ = try await session.data(for: req)
        } catch {
            // fire-and-forget
        }
    }
}
