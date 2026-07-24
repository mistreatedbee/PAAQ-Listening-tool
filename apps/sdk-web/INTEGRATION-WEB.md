# PAAQ Intelligence — Web SDK Integration Guide

Install and verify in under 5 minutes.

## Prerequisites

You need two values from your [PAAQ Intelligence dashboard](https://paaq-listening-tool.vercel.app/connect):

| Value | Where to find it | Example |
|---|---|---|
| **SDK Token** | Dashboard → Connect → Your credentials | `sdk_live_...` |
| **Project Key** | Dashboard → Connect → Your credentials | `proj_...` |

---

## React / Vite

```bash
npm install @paaq/web-sdk
```

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { paaq } from '@paaq/web-sdk'
import App from './App.tsx'

paaq.init('sdk_live_...', 'proj_...').then((result) => {
  if (result.ok) {
    console.log('[PAAQ] Connected — session:', result.sessionId)
    paaq.track('sdk_connected')
  } else {
    console.warn('[PAAQ] Connection failed:', result.error)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)
```

Track events anywhere in your app:

```tsx
// In any component
import { paaq } from '@paaq/web-sdk'

paaq.track('button_clicked', { buttonId: 'upgrade-cta', page: '/pricing' })
paaq.identify('user_123', { plan: 'pro', email: 'user@example.com' })
paaq.page('/dashboard')
```

---

## Next.js (App Router)

```bash
npm install @paaq/web-sdk
```

```tsx
// app/providers.tsx
'use client'
import { useEffect } from 'react'
import { paaq } from '@paaq/web-sdk'

export function PaaqProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    paaq.init('sdk_live_...', 'proj_...', { platform: 'nextjs' }).then((result) => {
      if (result.ok) console.log('[PAAQ] Connected — session:', result.sessionId)
    })
  }, [])
  return <>{children}</>
}
```

```tsx
// app/layout.tsx
import { PaaqProvider } from './providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PaaqProvider>{children}</PaaqProvider>
      </body>
    </html>
  )
}
```

---

## Vue 3

```bash
npm install @paaq/web-sdk
```

```ts
// src/main.ts
import { createApp } from 'vue'
import { paaq } from '@paaq/web-sdk'
import App from './App.vue'

paaq.init('sdk_live_...', 'proj_...', { platform: 'vue' }).then((result) => {
  if (result.ok) console.log('[PAAQ] Connected — session:', result.sessionId)
})

createApp(App).mount('#app')
```

---

## Plain HTML / CDN (no bundler)

```html
<script type="module">
  import { paaq } from 'https://cdn.jsdelivr.net/npm/@paaq/web-sdk/dist/index.mjs'

  const result = await paaq.init('sdk_live_...', 'proj_...')
  if (result.ok) {
    console.log('[PAAQ] Connected — session:', result.sessionId)
    paaq.track('page_view', { title: document.title })
  }
</script>
```

---

## API Reference

### `paaq.init(sdkToken, projectKey, options?)`

Authenticates the SDK and starts a session. Call once on app startup.

| Parameter | Type | Description |
|---|---|---|
| `sdkToken` | `string` | Your `sdk_live_...` token |
| `projectKey` | `string` | Your `proj_...` project key |
| `options.platform` | `string` | `'react'` \| `'nextjs'` \| `'vue'` \| `'vanilla'` |

Returns `Promise<InitResult>`:

```ts
{
  ok: boolean
  sessionId?: string   // use for linking events
  deviceId?: string
  config?: { batchSize: number; syncIntervalSeconds: number }
  error?: string       // only present when ok: false
}
```

### `paaq.track(eventName, properties?)`

Queues an event. Events are flushed in batches automatically.

```ts
paaq.track('button_clicked', { buttonId: 'cta', variant: 'A' })
paaq.track('form_submitted', { formName: 'signup', fields: 4 })
paaq.track('purchase_completed', { amount: 49.99, currency: 'USD', plan: 'pro' })
```

### `paaq.identify(userId, traits?)`

Associates the current session with a user.

```ts
paaq.identify('user_456', { email: 'alice@example.com', plan: 'enterprise' })
```

### `paaq.page(pageName?, properties?)`

Tracks a page view. Automatically uses `window.location.pathname` if no name is given.

```ts
paaq.page('/dashboard/overview')
paaq.page(undefined, { referrer: document.referrer })
```

### `paaq.flush()`

Forces an immediate event flush. Useful before navigation or logout.

```ts
window.addEventListener('beforeunload', () => paaq.flush())
```

---

## Verifying the Connection

After adding the SDK and starting your app:

1. **Browser console** — you should see `[PAAQ] Connected — session: <uuid>`
2. **PAAQ dashboard** → Overview — your project shows a green "Connected" badge
3. **Admin audit log** — run this query in Supabase:

```sql
SELECT * FROM admin_audit_log
WHERE action = 'sdk_init_success'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Missing Authorization header` | SDK token not passed to `init()` | Check you're passing `sdkToken` as the first argument |
| `Invalid SDK token format` | Token doesn't start with `sdk_live_` | Copy the token from Dashboard → Connect → Your credentials |
| `Project not found` | Wrong `projectKey` or token/project mismatch | Ensure both values are from the same project |
| `Project is suspended` | Account suspended | Contact support |
| Events not appearing | `flush()` never called | Events batch automatically — wait up to 30s, or call `paaq.flush()` manually |
| CORS error | Old function still in production | Redeploy the updated edge functions with `supabase functions deploy` |
