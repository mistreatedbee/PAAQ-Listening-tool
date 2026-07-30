import Foundation

public struct PaaqConfig {
    public let sdkToken: String
    public let projectId: String
    public let environment: String
    public let debug: Bool
    public let flushInterval: TimeInterval
    public let heartbeatInterval: TimeInterval
    public let batchSize: Int

    public init(
        sdkToken: String,
        projectId: String,
        environment: String = "production",
        debug: Bool = false,
        flushInterval: TimeInterval = 30,
        heartbeatInterval: TimeInterval = 300,
        batchSize: Int = 50
    ) {
        self.sdkToken = sdkToken
        self.projectId = projectId
        self.environment = environment
        self.debug = debug
        self.flushInterval = flushInterval
        self.heartbeatInterval = heartbeatInterval
        self.batchSize = batchSize
    }
}
