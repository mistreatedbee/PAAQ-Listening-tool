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

// Capture an error, optionally with extra context
do {
    try riskyOperation()
} catch {
    PAAQ.captureError(error, context: ["screen": "checkout"])
}

// Flush on app termination
await PAAQ.flush()

// End the session explicitly (e.g. on logout)
await PAAQ.endSessionOnLogout()
```

## Behavior analytics

Scroll and form tracking are **opt-in** — there is no universal iOS hook for
either (tap rage/dead detection is captured automatically). Wire these up from
your view controllers / delegate callbacks:

```swift
// Scroll depth — call from scrollViewDidScroll with the % scrolled (0-100).
// Milestones at 25/50/75/100% fire once.
PAAQ.trackScrollDepth(pct)

// Call when navigating so scroll depth is measured per screen.
PAAQ.resetScrollTracking()

// Form fields — call on focus, backspace, and blur of each field.
PAAQ.trackFieldFocus("email")
PAAQ.trackFieldBackspace("email")
PAAQ.trackFieldBlur("email", formName: "signup", hadError: false, completed: false)
PAAQ.trackFormAbandon("signup")
```

## Visual session replay

Screenshot-based replay runs automatically once initialized — it renders the
app's own view hierarchy (no screen-recording permission needed) and pauses
while a form field is focused. No extra setup required.

## Features

- Swift Concurrency (async/await) — no Combine or callbacks
- Actor-isolated event queue — thread-safe with no locks
- Automatic flush when app resigns active (before iOS suspends)
- Stable device ID via UserDefaults (persists across launches)
- 5-minute heartbeat keeps Connection Status green in your dashboard
- Rage/dead-tap detection (automatic) and opt-in scroll/form tracking
- Automatic screenshot-based visual session replay
- Zero third-party dependencies
