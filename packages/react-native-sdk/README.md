# @paaq/react-native-sdk

PAAQ Intelligence SDK for React Native and Expo apps — automatic session tracking, screen analytics, error capture, and real-time performance monitoring.

## Installation

```bash
npm install @paaq/react-native-sdk @react-native-async-storage/async-storage
```

For Expo:
```bash
npx expo install @paaq/react-native-sdk @react-native-async-storage/async-storage
```

For bare React Native, link the native module:
```bash
cd ios && pod install
```

## Quick start

```tsx
// App.tsx
import { PAAQ, PaaqTouchTracker } from '@paaq/react-native-sdk'
import { useEffect } from 'react'

export default function App() {
  useEffect(() => {
    PAAQ.initialize({
      sdkToken: 'sdk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      projectId: 'proj_xxxxxxxx',
    })
  }, [])

  // Wrap your root view so rage/dead-tap detection and (if you install
  // react-native-view-shot) screenshot-based session replay work.
  return (
    <PaaqTouchTracker>
      <YourApp />
    </PaaqTouchTracker>
  )
}
```

## Usage

```tsx
// Track a custom event
PAAQ.track('purchase_completed', { amount: 49.99, currency: 'USD' })

// Record a screen view
PAAQ.screen('CheckoutScreen')

// Identify the current user
await PAAQ.identify('user_123', { email: 'user@example.com', plan: 'pro' })

// Flush before logout
await PAAQ.flush()

// End the session explicitly (e.g. on logout)
await PAAQ.endSession('logged_out')

// Dispose on app termination
await PAAQ.dispose()
```

## Auto screen tracking (React Navigation)

If you use `@react-navigation/native`, report the active route from the
`NavigationContainer`'s `onStateChange`:

```tsx
import { PAAQ, trackNavigationScreen } from '@paaq/react-native-sdk'
import { useNavigationContainerRef } from '@react-navigation/native'

const navigationRef = useNavigationContainerRef()

<NavigationContainer
  ref={navigationRef}
  onStateChange={() => trackNavigationScreen(navigationRef.current?.getCurrentRoute()?.name)}
>
  <App />
</NavigationContainer>
```

## Behavior analytics

Tap, scroll, and form tracking are **opt-in** in React Native (unlike the web
SDK) — there is no app-wide touch/scroll hook in pure JS. Enable what you need:

```tsx
import { PAAQ, PaaqTouchTracker } from '@paaq/react-native-sdk'
import { onScroll } from 'your-scroll-api'

// Taps (rage/dead-tap detection): wrap your root view once.
// <PaaqTouchTracker><App /></PaaqTouchTracker>

// Scroll depth: report the % scrolled (25/50/75/100% milestones fire once).
function handleScroll(pct: number) {
  PAAQ.trackScrollDepth(pct)
}

// Form fields: call these on focus, backspace, and blur of each field.
function onFieldFocus(name: string) { PAAQ.trackFieldFocus(name) }
function onBackspace(name: string) { PAAQ.trackFieldBackspace(name) }
function onFieldBlur(name: string) { PAAQ.trackFieldBlur(name, { hadError: true, completed: false }) }
function onFormAbandon() { PAAQ.trackFormAbandon('signup') }
```

## Visual session replay

Screenshot-based replay is available when you install the optional native
dependency `react-native-view-shot`, then wrap your root view with
`PaaqTouchTracker` (screenshots pause while a form field is focused to avoid
capturing input):

```bash
npm install react-native-view-shot
cd ios && pod install
```

Skip `react-native-view-shot` and everything else still works — you simply
won't get screenshots.

## Features

- Automatic device ID persisted in AsyncStorage (survives app restarts)
- Flushes event queue when app goes to background (before iOS suspends JS)
- 5-minute heartbeat keeps Connection Status green in your dashboard
- Rage/dead-tap, scroll-depth, and form-abandon tracking (opt-in — see above)
- Optional screenshot-based visual session replay (`react-native-view-shot`)
- Works with both React Native and Expo (managed and bare workflow)
- Supports iOS and Android
