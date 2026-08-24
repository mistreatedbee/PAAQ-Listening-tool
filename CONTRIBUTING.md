# Contributing to PAAQ Listening Platform

Thanks for your interest in improving PAAQ! This guide covers the basics.

## Repository layout

See the [README](README.md) for the monorepo map and how the AI pipeline fits together.

## Getting started

```bash
npm install                 # install dashboard dependencies
cp .env.example .env.local  # then fill in your Supabase + OpenRouter values
npm run dev                 # start the dashboard at http://localhost:3000
```

Edge function secrets live in Supabase, not in the repo:

```bash
cd apps/api/supabase
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
supabase functions deploy   # deploy all functions
```

## Ground rules

- **One topic per PR.** Keep changes focused; split unrelated work into separate PRs.
- **Match existing style.** The codebase uses TypeScript strict mode, Tailwind utility classes, and a layered architecture (routes → services → repositories).
- **Explain why, not what.** Comments should carry intent and trade-offs, not narrate the code.
- **No secrets, ever.** Keys belong in `.env.local` / `supabase secrets`, never committed. `.env.example` documents every variable.
- **Tests matter.** If you change behavior, add or update tests where practical. CI runs a production build of the dashboard on every PR.

## Edge functions

Edge functions run on Deno inside Supabase. Shared logic lives in `apps/api/supabase/functions/_shared/`:

- `ai.ts` — single OpenAI-compatible client for all AI providers
- `agentic-fix.ts` — the fix-generation agent loop

When touching AI call sites: remember reasoning models consume `max_tokens`
before emitting visible output — see
[Discussion #4](https://github.com/mistreatedbee/PAAQ-Listening-tool/discussions/4)
for details.

## Migrations

Schema migrations are numbered SQL files in `apps/api/supabase/migrations/`.
New migrations should be idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`)
so they can be safely re-run against partially-migrated databases.

## Submitting

1. Fork (or branch from `main`)
2. Make your change
3. Verify `npm run build` passes
4. Open a pull request describing **what** changed and **why**

For bigger ideas or questions, open a
[Discussion](https://github.com/mistreatedbee/PAAQ-Listening-tool/discussions) first.
