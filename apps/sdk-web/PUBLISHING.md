# Publishing PAAQ SDKs

All latest versions live in **`packages/sdk-versions.json`**. Every consumer
(package manifests, source constants, dashboard, edge snippets, notifications)
is updated from that single file.

## Before you publish

1. Bump the version in `packages/sdk-versions.json` (package + affected platforms).
2. Add release notes to the package `CHANGELOG.md`.
3. Run sync + dry-run:

```bash
npm run sdk:sync-versions
npm run sdk:release:dry-run
```

## Publish @paaq/web-sdk

```bash
# Requires npm login + env vars for announce step:
#   SUPABASE_URL, REPO_CONNECTOR_INTERNAL_SECRET
npm run sdk:release
```

This will:

1. Sync versions everywhere (`scripts/sync-sdk-versions.mjs`)
2. Build `apps/sdk-web`
3. `npm publish --access public`
4. Call `announce-sdk-release` — updates the DB catalog and creates
   **in-app notifications for every project**, plus flags outdated SDK installs.

### Other packages

```bash
node scripts/release-sdk.mjs mcp-server
node scripts/release-sdk.mjs server-sdk
node scripts/release-sdk.mjs react-native-sdk
node scripts/release-sdk.mjs all --dry-run
```

Optional flags: `--skip-publish`, `--skip-announce`, `--notes "…"`.

## What gets updated automatically

| File / service | Purpose |
|----------------|---------|
| `apps/sdk-web/package.json` + `src/index.ts` | npm package |
| `apps/api/.../sdk-snippets.ts` | Connect / onboard snippets |
| `apps/dashboard/lib/sdk-versions.ts` | Banner fallback |
| `apps/api/.../sdk-versions.ts` | Edge function defaults |
| `sdk_release_catalog` (DB) | Live latest versions |
| `notifications` (DB) | Release + outdated SDK alerts |
| `get-sdk-versions` edge fn | Dashboard fetches live catalog |

## Manual announce (already published)

If publish succeeded but announce was skipped (missing env vars):

```bash
# Pull production env once (includes REPO_CONNECTOR_INTERNAL_SECRET)
cd apps/dashboard && vercel env pull .env.release.local --environment=production

# Then announce from repo root
npm run sdk:announce
```

Or with explicit env:

```bash
export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
export REPO_CONNECTOR_INTERNAL_SECRET=your-secret
node scripts/announce-sdk-release.mjs web --notes "Release notes here"
```
