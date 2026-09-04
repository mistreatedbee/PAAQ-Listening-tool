# @paaq/sdk

**One package for every JavaScript surface** — web, Node.js, and React Native.

```bash
npm install @paaq/sdk
```

## Initialize (same API everywhere)

```ts
import { PAAQ } from '@paaq/sdk'

await PAAQ.initialize({
  sdkToken: 'your_sdk_token',
  projectId: 'your_project_id',
})
```

Bundlers pick the right build automatically:

| Environment | Resolved entry |
|-------------|----------------|
| Browser / React / Next / Vue | `dist/web.mjs` |
| Node.js / Express | `dist/node.mjs` |
| React Native / Expo | `dist/react-native.mjs` |

## Explicit imports (optional)

```ts
import { PAAQ } from '@paaq/sdk/web'
import { PAAQ } from '@paaq/sdk/node'
import { PAAQ, PaaqTouchTracker } from '@paaq/sdk/react-native'
```

## React Native peer dependencies

```bash
npm install @paaq/sdk @react-native-async-storage/async-storage
```

## Legacy packages

`@paaq/web-sdk`, `@paaq/server-sdk`, and `@paaq/react-native-sdk` remain published for existing installs. New projects should use `@paaq/sdk`.
