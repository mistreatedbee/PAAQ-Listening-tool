# PAAQ Intelligence Android SDK

The official Android SDK for [PAAQ Intelligence](https://paaq.io) — automatic session tracking, error capture, screen analytics, and real-time performance monitoring for native Android apps.

## Requirements

- Android API 21+ (Android 5.0 Lollipop)
- Kotlin 1.8+

## Installation

### JitPack (Gradle)

Add JitPack to your root `settings.gradle.kts`:

```kotlin
dependencyResolutionManagement {
    repositories {
        // ...
        maven { url = uri("https://jitpack.io") }
    }
}
```

Add the dependency to your app's `build.gradle.kts`:

```kotlin
dependencies {
    implementation("com.github.mistreatedbee.PAAQ-Listening-tool:paaq-intelligence-android:1.0.0")
}
```

Add `INTERNET` permission to your `AndroidManifest.xml` (already included in the library manifest):

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

## Quick start

```kotlin
// MyApplication.kt
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        PAAQ.initialize(
            context = this,
            sdkToken = "sdk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            projectId = "proj_xxxxxxxx",
        )
    }
}
```

Register your Application class in `AndroidManifest.xml`:

```xml
<application android:name=".MyApplication" ...>
```

## Usage

```kotlin
// Track a custom event
PAAQ.track("purchase_completed", mapOf("amount" to 49.99, "currency" to "USD"))

// Record a screen view (auto-tracked from onResume; call manually only as needed)
PAAQ.screen("CheckoutActivity")

// Identify the current user
PAAQ.identify("user_123", mapOf("email" to "user@example.com", "plan" to "pro"))

// Capture an exception, optionally with extra context
try {
    riskyOperation()
} catch (e: Exception) {
    PAAQ.captureException(e, mapOf("screen" to "checkout"))
}

// End the session explicitly (e.g. on logout)
PAAQ.endSessionOnLogout()

// Dispose on app exit
override fun onTerminate() {
    PAAQ.dispose()
    super.onTerminate()
}
```

## Auto-tracked (no setup)

Screen views, rage/dead-tap detection, and screenshot-based session replay are
all installed automatically by `initialize()` — screen tracking via
`ActivityLifecycleCallbacks`, taps via a `Window.Callback` wrapper, and screenshots
by rendering the current view hierarchy (paused while a form field is focused).

## Behavior analytics (opt-in)

Scroll and form tracking have no app-wide Android hook, so wire them into your
existing listeners:

```kotlin
// Scroll depth — from a RecyclerView/NestedScrollView scroll listener (0-100).
// Milestones at 25/50/75/100% fire once.
PAAQ.trackScrollDepth(pct)

// Call when navigating so scroll depth is measured per screen.
PAAQ.resetScrollTracking()

// Form fields — call on focus, backspace, and blur of each field.
PAAQ.trackFieldFocus("email")
PAAQ.trackFieldBackspace("email")
PAAQ.trackFieldBlur("email", formName = "signup", hadError = false, completed = false)
PAAQ.trackFormAbandon("signup")
```

## Features

- Zero extra dependencies beyond Kotlin Coroutines (already in any modern Android project)
- Stable per-install device ID via SharedPreferences
- 5-minute heartbeat keeps Connection Status green in your dashboard
- Thread-safe event queue with synchronized batching
- Automatic screen, rage/dead-tap, and screenshot-replay capture
- Opt-in scroll and form-friction tracking
- Uses `HttpURLConnection` — no OkHttp or Retrofit required
