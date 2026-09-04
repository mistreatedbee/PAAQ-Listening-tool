# PAAQ Intelligence — Agent System Prompt (2026-09-04)

Read this file at the start of every autonomous or multi-agent session. Also read `PROGRESS.md` and `API-USAGE.md`.

## Product

**PAAQ Intelligence** is an AI-native product intelligence platform. Customers connect apps (web, mobile, server, database). The SDK streams telemetry; the dashboard shows sessions, errors, replay, knowledge graph, and AI investigations.

- **Dashboard:** Next.js on Vercel (`apps/dashboard`)
- **API:** Supabase edge functions (`apps/api/supabase/functions`)
- **Supabase project:** `mookyonwpovxscsbqwwl`
- **GitHub:** `mistreatedbee/PAAQ-Listening-tool`
- **Goal:** 1,000 active users

## SDK — ONE package for JavaScript (canonical)

```bash
npm install @paaq/sdk@latest
```

```ts
import { PAAQ } from '@paaq/sdk'

await PAAQ.initialize({
  sdkToken: 'sdk_live_…',  // Bearer token from access_tokens
  projectId: 'proj_…',     // project_id_key (X-Project-ID)
})
```

| Surface | Resolved build | Notes |
|---------|----------------|-------|
| Web (React/Next/Vue) | `dist/web.mjs` | DOM replay (rrweb), clicks, errors, perf |
| Node/Express | `dist/node.mjs` | `PAAQ.middleware()` after init |
| React Native | `dist/react-native.mjs` | Also install `@react-native-async-storage/async-storage` |

Explicit subpaths: `@paaq/sdk/web`, `@paaq/sdk/node`, `@paaq/sdk/react-native`.

**Legacy packages** (still on npm, do not use in new snippets): `@paaq/web-sdk`, `@paaq/server-sdk`, `@paaq/react-native-sdk`.

**Internal:** `@paaq/sdk-core` — shared transport; pulled automatically by `@paaq/sdk`.

**Non-JS:** Flutter `paaq_intelligence`, iOS/Android via GitHub SPM/JitPack, Python `paaq-server-sdk` (PyPI may be unpublished — verify before documenting).

## npm publish

From repo root (requires npm 2FA):

```bash
node scripts/release-sdk.mjs sdk --skip-announce
```

Publish order when releasing core + dependents: `core` → `sdk` → legacy packages if bumped.

Current catalog: `packages/sdk-versions.json`.

## Knowledge platform (shipped on main)

- **Auto-discovery:** `sync-knowledge-registries` — features, screens, APIs, journeys, services, schema from telemetry + AI + DB introspection
- **Knowledge graph:** deduped nodes, Executive/Product/Technical views, inferred relationships
- **DB connector:** `db-connector` pipeline introspects Postgres/MySQL/MongoDB/etc. and feeds knowledge graph

## AI provider

- **OpenRouter** (`OPENROUTER_API_KEY`), model chain with fallbacks
- NOT Anthropic direct — all AI via `_shared/ai.ts` → `openRouterChat`

## Auth & secrets

- SDK init: `Authorization: Bearer <sdk_token>`, `X-Project-ID: <project_id_key>`
- Internal edge ↔ dashboard: `REPO_CONNECTOR_INTERNAL_SECRET` (must match Supabase + Vercel)
- Never log secret values; use length-only probes when debugging 401s

## Agent rules

1. **Read `PROGRESS.md` first** — reuse prior conclusions; append new work at top of Latest Work
2. **API budget** — ~4 req/min; prefer shell/grep/read over model calls
3. **SDK snippets** — always `@paaq/sdk` + `PAAQ.initialize({ sdkToken, projectId })` in dashboard/onboarding/docs
4. **Credentials in snippets** — sdkToken = bearer (`sdk_live_…`), projectId = `proj_…` key (NOT uuid, NOT api key field names swapped)
5. **Do not invent** legal URLs, PyPI packages, or npm packages without verifying `npm view` / live registry
6. **Forge workflow** — branch/commit/PR only when user asks; push to main when user explicitly allows
7. **Tests** — run `npm run build` in dashboard; `npm run sdk:build:unified` for SDK changes

## SafeCloudAfrica / customer install troubleshooting

| Error | Fix |
|-------|-----|
| `E404 @paaq/sdk` | Wait 2–5 min after publish; use `@paaq/sdk@1.4.2` |
| `ERESOLVE react-native` on web-only app | Upgrade to `@paaq/sdk@1.4.2+` (RN peers optional) or `npm install @paaq/sdk --legacy-peer-deps` |
| `file:../../packages/sdk-core` in web-sdk | Use `@paaq/sdk` not `@paaq/web-sdk@1.3.0` |

## Build commands

```bash
npm run sdk:build:core      # packages/sdk-core
npm run sdk:build:unified   # packages/sdk (@paaq/sdk)
npm run sdk:build:all       # core + unified + legacy + web-sdk
npm run build               # dashboard
```

## Still blocked / verify before shipping

- PyPI `paaq-server-sdk` — may 404
- npm `@paaq/mcp-server`, `@paaq/cli` — unpublished
- JitPack Android — smoke-test on tagged release
