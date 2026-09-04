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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile(rel) {
  const file = path.join(ROOT, rel)
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq)
    let val = trimmed.slice(eq + 1)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile('apps/dashboard/.env.local')
loadEnvFile('apps/dashboard/.env.release.local')
loadEnvFile('.env.local')

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/sdk-versions.json'), 'utf8'))

const ALIASES = {
  web: '@paaq/web-sdk',
  'web-sdk': '@paaq/web-sdk',
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
const secret = process.env.REPO_CONNECTOR_INTERNAL_SECRET
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !secret) {
  console.error(
    'Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and REPO_CONNECTOR_INTERNAL_SECRET.\n' +
      'Tip: vercel env pull apps/dashboard/.env.release.local --environment=production',
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
  console.error('announce-sdk-release failed:', body)
  process.exit(1)
}

console.log('Release announced:', body)
