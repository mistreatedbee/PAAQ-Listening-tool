import Foundation

struct PaaqEvent: Encodable {
    let event_name: String
    let session_id: String?
    let properties: [String: AnyCodable]
    let timestamp: String
}

// Minimal type-erased Encodable wrapper for mixed-type property dictionaries
struct AnyCodable: Encodable {
    private let _encode: (Encoder) throws -> Void

    init<T: Encodable>(_ value: T) {
        _encode = { encoder in try value.encode(to: encoder) }
    }

    init(_ value: Any) {
        _encode = { encoder in
            var container = encoder.singleValueContainer()
            switch value {
            case let v as String:  try container.encode(v)
            case let v as Int:     try container.encode(v)
            case let v as Double:  try container.encode(v)
            case let v as Bool:    try container.encode(v)
            case let v as [String: Any]:
                let mapped = v.mapValues { AnyCodable($0) }
                try container.encode(mapped)
            default:
                try container.encode(String(describing: value))
            }
        }
    }

    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}
