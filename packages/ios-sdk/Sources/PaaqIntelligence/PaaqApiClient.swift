import Foundation
#if canImport(UIKit)
import UIKit
#endif

private let baseURL = "https://mookyonwpovxscsbqwwl.supabase.co/functions/v1"
private let sdkVersion = "1.0.0"

/// Real device metadata reported once at init — first-party OS APIs only,
/// nothing inferred or backfilled server-side (unlike the web SDK, which has
/// only a raw User-Agent string to work with).
struct PaaqDeviceMetadata: Encodable {
    let osName: String
    let osVersion: String
    let deviceModel: String
    let deviceType: String
    let screenWidth: Int?
    let screenHeight: Int?

    static func collect() -> PaaqDeviceMetadata {
#if canImport(UIKit)
        let device = UIDevice.current
        let bounds = UIScreen.main.bounds
        let scale = UIScreen.main.scale
        return PaaqDeviceMetadata(
            osName: device.systemName,
            osVersion: device.systemVersion,
            deviceModel: device.model,
            deviceType: device.userInterfaceIdiom == .pad ? "tablet" : "mobile",
            screenWidth: Int(bounds.width * scale),
            screenHeight: Int(bounds.height * scale)
        )
#else
        return PaaqDeviceMetadata(
            osName: "macOS", osVersion: ProcessInfo.processInfo.operatingSystemVersionString,
            deviceModel: "Mac", deviceType: "desktop", screenWidth: nil, screenHeight: nil
        )
#endif
    }
}

private struct SdkInitBody: Encodable {
    let deviceId: String
    let appVersion: String?
    let deviceMetadata: PaaqDeviceMetadata
}

private struct SessionEndBody: Encodable {
    let action = "end"
    let session_id: String
    let duration: Int
    let outcome: String
}

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
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
        req.httpBody = try JSONEncoder().encode(SdkInitBody(
            deviceId: deviceId,
            appVersion: appVersion,
            deviceMetadata: PaaqDeviceMetadata.collect()
        ))

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

    func endSession(sessionId: String, duration: Int, outcome: String) async {
        do {
            var req = URLRequest(url: URL(string: "\(baseURL)/sessions")!)
            req.httpMethod = "POST"
            headers.forEach { req.setValue($1, forHTTPHeaderField: $0) }
            req.httpBody = try JSONEncoder().encode(SessionEndBody(session_id: sessionId, duration: duration, outcome: outcome))
            _ = try await session.data(for: req)
        } catch {
            // fire-and-forget
        }
    }

    /// Uploads one recording chunk (a JPEG screenshot for iOS) to the private
    /// session-recordings bucket. Query-param metadata, raw bytes as the
    /// body — mirrors the web SDK's upload shape.
    func uploadRecordingChunk(sessionId: String, sequence: Int, capturedAtIso: String, bytes: Data, contentType: String) async {
        guard var components = URLComponents(string: "\(baseURL)/session-recording-upload") else { return }
        components.queryItems = [
            URLQueryItem(name: "session_id", value: sessionId),
            URLQueryItem(name: "kind", value: "screenshots"),
            URLQueryItem(name: "sequence", value: String(sequence)),
            URLQueryItem(name: "captured_at", value: capturedAtIso),
        ]
        guard let url = components.url else { return }
        do {
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            headers.forEach { req.setValue($1, forHTTPHeaderField: $0) }
            req.setValue(contentType, forHTTPHeaderField: "Content-Type")
            req.httpBody = bytes
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
