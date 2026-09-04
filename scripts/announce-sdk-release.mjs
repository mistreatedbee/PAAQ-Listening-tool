#!/usr/bin/env node
/**
 * Announce an already-published SDK version (creates notifications + updates catalog).
 *
 * Usage:
 *   node scripts/announce-sdk-release.mjs web
 *   node scripts/announce-sdk-release.mjs @paaq/web-sdk 1.2.9 --notes "…"
 *
 * Loads env from apps/dashboard/.env.local and .env.release.local when present.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadSdkReleaseEnv, ROOT } from './load-env.mjs'

loadSdkReleaseEnv()

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/sdk-versions.json'), 'utf8'))

const ALIASES = {
  web: '@paaq/web-sdk',
  'web-sdk': '@paaq/web-sdk',
  sdk: '@paaq/sdk',
  unified: '@paaq/sdk',
  mcp: '@paaq/mcp-server',
  'mcp-server': '@paaq/mcp-server',
}

const argv = process.argv.slice(2)
const notesIdx = argv.indexOf('--notes')
const releaseNotes = notesIdx >= 0 ? argv[notesIdx + 1] : undefined
const positional = argv.filter((a, i) => !a.startsWith('--') && i !== notesIdx + 1)

let packageName = positional[0]
let version = positional[1]

if (packageName && ALIASES[packageName]) packageName = ALIASES[packageName]
if (packageName && !packageName.startsWith('@')) packageName = ALIASES[packageName] ?? packageName

if (!packageName || packageName.startsWith('@') === false) {
  const alias = positional[0] ?? 'web'
  packageName = ALIASES[alias] ?? alias
}

const pkg = catalog.packages[packageName]
if (!pkg) {
  console.error(`Unknown package: ${packageName}`)
  process.exit(1)
}

version = version ?? pkg.version
const platforms = pkg.platforms ?? []

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.REPO_CONNECTOR_INTERNAL_SECRET?.trim()
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !secret) {
  console.error(
    'Missing SUPABASE_URL and REPO_CONNECTOR_INTERNAL_SECRET.\n' +
      'Paste Production REPO_CONNECTOR_INTERNAL_SECRET from Vercel into /.env.local\n' +
      '(ignore apps/dashboard/.env.release.local if it contains [SENSITIVE] placeholders)',
  )
  process.exit(1)
}

if (!anonKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY (required by Supabase gateway).\n' +
      'Add it to apps/dashboard/.env.local or repo root .env.local',
  )
  process.exit(1)
}

const res = await fetch(`${supabaseUrl}/functions/v1/announce-sdk-release`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
    'x-internal-secret': secret,
  },
  body: JSON.stringify({
    package_name: packageName,
    version,
    platforms,
    release_notes: releaseNotes ?? '',
  }),
})

const body = await res.json().catch(() => ({}))
if (!res.ok) {
  if (res.status === 401) {
    console.error(
      'announce-sdk-release failed: Unauthorized — REPO_CONNECTOR_INTERNAL_SECRET does not match Supabase.\n' +
        '1. Copy Production value from Vercel into /.env.local\n' +
        '2. Sync to Supabase: npm run sdk:sync-secret\n' +
        '3. Retry: npm run sdk:announce',
    )
  } else {
    console.error('announce-sdk-release failed:', body)
  }
  process.exit(1)
}

console.log('Release announced:', body)
