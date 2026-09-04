# PAAQ SDK Core — shared protocol

One transport contract for **every surface** PAAQ connects to:

| Surface | Package | Uses sdk-core |
|---------|---------|---------------|
| Web (React, Next, Vue, Vanilla) | `@paaq/web-sdk` | Types + protocol (transport migration in progress) |
| Mobile app (React Native) | `@paaq/react-native-sdk` | Yes — HTTP, batching, headers |
| Node / Express backend | `@paaq/server-sdk` | Yes — HTTP, batching, headers |
| Database (Postgres, MySQL, MongoDB, …) | Dashboard `db-connector` | Same schema types + engines list |
| Native iOS / Android | Swift / Kotlin SDKs | Same endpoints + headers (mirror) |
| Flutter | `paaq_intelligence` | Same endpoints + headers (mirror) |

## Shared endpoints

All clients call the same Supabase edge functions:

- `POST /sdk-init` — open session, register device
- `POST /events` — batched telemetry
- `POST /errors` — error reports
- `POST /sdk-heartbeat` — liveness
- `POST /sessions` — end session, link user
- `POST /users` — resolve external user id
- `POST /db-connector` — connect + introspect database (dashboard / MCP)

## Standard headers

```
Authorization: Bearer <sdk_token>
X-Project-ID: <project_id_key>
X-SDK-Version: <semver>
X-Platform: web | react | ios-rn | nodejs | postgres | …
X-Environment: production | staging | development
```

## Database engines

`DATABASE_ENGINES` in `@paaq/sdk-core` matches `db-connector`:

`postgres`, `supabase`, `mysql`, `mongodb`, `sqlite`, `redis`

Introspected schema feeds the knowledge graph automatically (services + schema docs).

## Build order

```bash
npm run sdk:build:core
npm run sdk:build:all
```
