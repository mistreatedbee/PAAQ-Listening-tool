import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// PAAQ Intelligence SDK — iOS, macOS, tvOS, watchOS
public final class PAAQ {

    // MARK: - Public API

    /// Initialize the SDK. Call once, typically at app launch.
    @discardableResult
    public static func initialize(
        sdkToken: String,
        projectId: String,
        environment: String = "production",
        debug: Bool = false
    ) async -> Bool {
        return await shared.start(
            config: PaaqConfig(
                sdkToken: sdkToken,
                projectId: projectId,
                environment: environment,
                debug: debug
            )
        )
    }

    /// Track a custom event
    public static func track(_ eventName: String, properties: [String: Any] = [:]) {
        shared.enqueue(eventName: eventName, properties: properties)
    }

    /// Identify the current user
    public static func identify(_ userId: String, traits: [String: Any] = [:]) {
        var props = traits
        props["userId"] = userId
        shared.enqueue(eventName: "$identify", properties: props)
    }

    /// Record a screen view
    public static func screen(_ name: String) {
        shared.enqueue(eventName: "$screen", properties: ["name": name])
    }

    /// Capture an error
    public static func captureError(_ error: Error, context: [String: Any] = [:]) {
        var props: [String: Any] = [
            "error_type": String(describing: type(of: error)),
            "error_message": error.localizedDescription,
        ]
        props.merge(context) { $1 }
        shared.enqueue(eventName: "$error", properties: props)
    }

    /// Flush pending events to the backend
    public static func flush() async {
        await shared.flush()
    }

    /// Dispose and flush — call before app termination
    public static func dispose() async {
        await shared.teardown()
    }

    // MARK: - Private singleton

    private static let shared = PaaqInstance()
}

// MARK: - Internal actor

private actor PaaqInstance {
    private var api: PaaqApiClient?
    private var sessionId: String?
    private var queue: [PaaqEvent] = []
    private var batchSize = 50
    private var flushInterval: TimeInterval = 30
    private var flushTask: Task<Void, Never>?
    private var heartbeatTask: Task<Void, Never>?
    private var debug = false

    func start(config: PaaqConfig) async -> Bool {
        debug = config.debug
        let deviceId = getOrCreateDeviceId()
        let client = PaaqApiClient(config: config, deviceId: deviceId)
        api = client

        do {
            let result = try await client.sdkInit()
            sessionId = result.sessionId
            if let bs = result.serverBatchSize { batchSize = bs }
            if let fi = result.serverFlushInterval { flushInterval = fi }
            log("Initialized — session: \(sessionId ?? "nil")")
            startFlushLoop()
            startHeartbeatLoop()
            registerLifecycleObservers()
            return result.sessionId != nil
        } catch {
            log("Init failed: \(error)")
            return false
        }
    }

    func enqueue(eventName: String, properties: [String: Any]) {
        let props = properties.mapValues { AnyCodable($0) }
        queue.append(PaaqEvent(
            event_name: eventName,
            session_id: sessionId,
            properties: props,
            timestamp: ISO8601DateFormatter().string(from: Date())
        ))
        log("Queued \(eventName) (total: \(queue.count))")
        if queue.count >= batchSize { Task { await flush() } }
    }

    func flush() async {
        guard let api, !queue.isEmpty else { return }
        let batch = queue
        queue = []
        log("Flushing \(batch.count) events")
        await api.flush(events: batch)
    }

    func teardown() async {
        flushTask?.cancel()
        heartbeatTask?.cancel()
        await flush()
    }

    private func startFlushLoop() {
        flushTask?.cancel()
        flushTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(flushInterval * 1_000_000_000))
                await flush()
            }
        }
    }

    private func startHeartbeatLoop() {
        heartbeatTask?.cancel()
        heartbeatTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 300_000_000_000) // 5 minutes
                guard let api else { continue }
                await api.heartbeat()
            }
        }
    }

    private func registerLifecycleObservers() {
#if canImport(UIKit)
        NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: nil
        ) { [weak self] _ in
            // Flush before iOS suspends the app
            Task { [weak self] in await self?.flush() }
        }
#endif
    }

    private func log(_ message: String) {
        if debug { print("[PAAQ] \(message)") }
    }

    // MARK: - Device ID

    private func getOrCreateDeviceId() -> String {
        let key = "io.paaq.device_id"
        if let existing = UserDefaults.standard.string(forKey: key) { return existing }
        let id = UUID().uuidString
        UserDefaults.standard.set(id, forKey: key)
        return id
    }
}
