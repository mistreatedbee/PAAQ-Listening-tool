# PaaqIntelligence

The official Swift SDK for [PAAQ Intelligence](https://paaq.io) — automatic session tracking, error capture, screen analytics, and real-time performance monitoring for iOS, macOS, tvOS, and watchOS apps.

## Requirements

- iOS 15+ / macOS 12+ / tvOS 15+ / watchOS 8+
- Swift 5.7+

## Installation

### Swift Package Manager

In Xcode: **File → Add Package Dependencies** and enter:

```
https://github.com/mistreatedbee/PAAQ-Listening-tool
```

Then select `PaaqIntelligence` from the `packages/ios-sdk` path.

Or add to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/mistreatedbee/PAAQ-Listening-tool", from: "1.0.0")
]
```

## Quick start

```swift
import PaaqIntelligence

@main
struct MyApp: App {
    init() {
        Task {
            await PAAQ.initialize(
                sdkToken: "sdk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                projectId: "proj_xxxxxxxx"
            )
        }
    }

    var body: some Scene {
        WindowGroup { ContentView() }
    }
}
```

## Usage

```swift
// Track a custom event
PAAQ.track("purchase_completed", properties: ["amount": 49.99, "currency": "USD"])

// Record a screen view
PAAQ.screen("CheckoutView")

// Identify the current user
PAAQ.identify("user_123", traits: ["email": "user@example.com", "plan": "pro"])

// Capture an error
do {
    try riskyOperation()
} catch {
    PAAQ.captureError(error)
}

// Flush on app termination
await PAAQ.flush()
```

## Features

- Swift Concurrency (async/await) — no Combine or callbacks
- Actor-isolated event queue — thread-safe with no locks
- Automatic flush when app resigns active (before iOS suspends)
- Stable device ID via UserDefaults (persists across launches)
- 5-minute heartbeat keeps Connection Status green in your dashboard
- Zero third-party dependencies
