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
import { PAAQ } from '@paaq/react-native-sdk'
import { useEffect } from 'react'

export default function App() {
  useEffect(() => {
    PAAQ.initialize({
      sdkToken: 'sdk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      projectId: 'proj_xxxxxxxx',
    })
  }, [])

  return <YourApp />
}
```

## Usage

```tsx
// Track a custom event
PAAQ.track('purchase_completed', { amount: 49.99, currency: 'USD' })

// Record a screen view
PAAQ.screen('CheckoutScreen')

// Identify the current user
PAAQ.identify('user_123', { email: 'user@example.com', plan: 'pro' })

// Flush before logout
await PAAQ.flush()

// Dispose on app termination
await PAAQ.dispose()
```

## Features

- Automatic device ID persisted in AsyncStorage (survives app restarts)
- Flushes event queue when app goes to background (before iOS suspends JS)
- 5-minute heartbeat keeps Connection Status green in your dashboard
- Works with both React Native and Expo (managed and bare workflow)
- Supports iOS and Android
