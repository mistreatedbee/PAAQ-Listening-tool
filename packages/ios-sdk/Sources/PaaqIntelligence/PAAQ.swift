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
        await shared.teardown(outcome: "completed")
    }

    /// End the current session because the host app knows the user logged
    /// out — the SDK cannot infer this on its own.
    public static func endSessionOnLogout() async {
        await shared.teardown(outcome: "logged_out")
    }

    // MARK: - Private singleton

    private static let shared = PaaqInstance()
}

// MARK: - Internal actor

private actor PaaqInstance {
    private var api: PaaqApiClient?
    private var sessionId: String?
    private var sessionStartedAt: Date?
    private var sessionEnded = false
    private var explicitDispose = false
    private var queue: [PaaqEvent] = []
    private var batchSize = 50
    private var flushInterval: TimeInterval = 30
    private var flushTask: Task<Void, Never>?
    private var heartbeatTask: Task<Void, Never>?
    private var backgroundGraceTask: Task<Void, Never>?
    private var debug = false

    func start(config: PaaqConfig) async -> Bool {
        debug = config.debug
        let deviceId = getOrCreateDeviceId()
        let client = PaaqApiClient(config: config, deviceId: deviceId)
        api = client

        do {
            let result = try await client.sdkInit()
            sessionId = result.sessionId
            sessionStartedAt = Date()
            sessionEnded = false
            explicitDispose = false
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

    func teardown(outcome: String) async {
        explicitDispose = true
        flushTask?.cancel()
        heartbeatTask?.cancel()
        backgroundGraceTask?.cancel()
        await flush()
        await endSession(outcome: outcome)
    }

    private func endSession(outcome: String) async {
        guard let api, let sessionId, !sessionEnded else { return }
        sessionEnded = true
        let duration = sessionStartedAt.map { Int(Date().timeIntervalSince($0)) } ?? 0
        await api.endSession(sessionId: sessionId, duration: duration, outcome: outcome)
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

    // Grace period after backgrounding before a session is considered ended —
    // distinguishes a brief app-switch from the user actually being done.
    private static let backgroundGracePeriod: UInt64 = 30_000_000_000 // 30s in nanoseconds

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

        NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: nil
        ) { [weak self] _ in
            Task { [weak self] in await self?.onBackgrounded() }
        }

        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: nil
        ) { [weak self] _ in
            Task { [weak self] in await self?.onForegrounded() }
        }

        NotificationCenter.default.addObserver(
            forName: UIApplication.willTerminateNotification,
            object: nil,
            queue: nil
        ) { [weak self] _ in
            // Real app termination — if dispose() wasn't called explicitly
            // first, this wasn't a deliberate teardown. Best-effort only:
            // iOS gives very little time to run code here.
            Task { [weak self] in await self?.onWillTerminate() }
        }
#endif
    }

    private func onBackgrounded() async {
        backgroundGraceTask?.cancel()
        backgroundGraceTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: PaaqInstance.backgroundGracePeriod)
            guard !Task.isCancelled else { return }
            await self?.endSession(outcome: "completed")
        }
    }

    private func onForegrounded() async {
        backgroundGraceTask?.cancel()
    }

    private func onWillTerminate() async {
        guard !explicitDispose else { return }
        await endSession(outcome: "force_closed")
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
