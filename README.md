# PAAQ Listening Platform

AI-native product intelligence. PAAQ captures errors, sessions, journeys, performance and behavior friction from your app, then uses AI agents to investigate what broke, why it happened, and how to fix it — down to exact files and patch plans.

## What's inside

| Path | What it is |
|---|---|
| `apps/dashboard` | Next.js dashboard — incidents, investigations, insights, analytics, settings |
| `apps/api/supabase/functions` | Deno edge functions — telemetry ingestion + AI pipeline (investigate, analyze, agentic fix, onboarding agent) |
| `apps/api/supabase/migrations` | Postgres schema migrations |
| `apps/sdk-web` | Web SDK integration guide and demo |
| `packages/server-sdk` | Server-side SDK |
| `packages/react-native-sdk` | React Native SDK |
| `packages/flutter-sdk` | Flutter SDK |
| `packages/ios-sdk` | iOS SDK |
| `packages/android-sdk` | Android SDK |
| `examples/codex-python` | Python example client |

## How the AI pipeline works

1. **SDKs** stream events, errors, session replays and performance metrics to the ingestion functions.
2. **Analyze** scores feature health, rebuilds user journeys and detects anomalies.
3. **Investigate** runs 8 specialist agents (incident, root cause, product, UX, QA, performance, security, executive) that correlate live telemetry with your connected repository.
4. **Generate / Execute Fix** produces structured patch plans with affected files, evidence and confidence scores.
5. All AI calls route through an OpenAI-compatible client — **NVIDIA Integrate API** (`moonshotai/kimi-k3`) when `NVIDIA_API_KEY` is set, with **OpenRouter** as fallback when Kimi is slow or unavailable.

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- An [NVIDIA API](https://build.nvidia.com) key (`NVIDIA_API_KEY`) and/or an [OpenRouter](https://openrouter.ai) API key (fallback)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` and fill in your values:

```bash
cp .env.example .env.local
```

Dashboard values go in `apps/dashboard/.env.local`. Edge function secrets are set via the Supabase CLI:

```bash
supabase secrets set NVIDIA_API_KEY=nvapi-...
# Optional fallback when Kimi exceeds edge-fn latency:
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
```

See `.env.example` for the full list of required variables.

### 3. Run the database migrations

```bash
cd apps/api/supabase
supabase db push
```

### 4. Deploy the edge functions

```bash
supabase functions deploy
```

### 5. Start the dashboard

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect an app, and integrate one of the SDKs to start streaming telemetry.

## Scripts

From the repo root:

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js dashboard in dev mode |
| `npm run build` | Production build of the dashboard |
| `npm start` | Serve the production build |

## Tech stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS, lucide-react
- **Backend:** Supabase (Postgres, Auth, Storage, Edge Functions on Deno)
- **AI:** NVIDIA Integrate API (`moonshotai/kimi-k3`) with OpenRouter fallback
- **SDKs:** TypeScript (web/server/RN), Swift, Kotlin, Dart

## Contributing

PRs welcome. Please keep changes focused, add tests where practical, and match existing code style. For bigger changes, open an issue or a Discussion first.

## License

All rights reserved. Contact the maintainers for licensing questions.
