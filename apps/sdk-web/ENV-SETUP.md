# Where to get SDK release env vars

## `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`

**Same value** — your Supabase project URL.

| Where | Path |
|-------|------|
| Supabase Dashboard | [Project](https://supabase.com/dashboard/project/mookyonwpovxscsbqwwl) → **Settings** → **API** → **Project URL** |
| Already in repo | `apps/dashboard/.env.local` |

```
https://mookyonwpovxscsbqwwl.supabase.co
```

## `REPO_CONNECTOR_INTERNAL_SECRET`

A shared password between the dashboard and edge functions (not the anon key).

| Where | Path |
|-------|------|
| **Vercel (easiest)** | [Vercel project](https://vercel.com) → **paaq-listening-tool** → **Settings** → **Environment Variables** → `REPO_CONNECTOR_INTERNAL_SECRET` → **Production** → reveal value |
| Supabase | Confirms it is set: `cd apps/api && supabase secrets list` (values are masked; use Vercel to read the real string) |

## Where to add them

| File | Used by |
|------|---------|
| **Repo root** `.env.local` | `npm run sdk:release`, `npm run sdk:announce` |
| **`apps/dashboard/.env.local`** | Next.js dashboard (git connect, onboard agent, etc.) |

Both files are **gitignored**. Never commit secrets.

### Quick setup

1. Open Vercel → copy `REPO_CONNECTOR_INTERNAL_SECRET` (Production).
2. Paste into:
   - `/.env.local` → `REPO_CONNECTOR_INTERNAL_SECRET=...`
   - `apps/dashboard/.env.local` → same line (already has a blank slot).
3. Test announce (no republish):
   ```bash
   npm run sdk:announce
   ```

You should see: `Release announced: { ok: true, ... }`
