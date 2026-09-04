#!/usr/bin/env node
/**
 * Prepare, validate, publish, and announce a PAAQ SDK package.
 *
 * Usage:
 *   node scripts/release-sdk.mjs web [--dry-run] [--skip-publish] [--notes "…"]
 *   node scripts/release-sdk.mjs mcp-server
 *   node scripts/release-sdk.mjs all --dry-run
 *
 * After publish, calls announce-sdk-release so every project gets an in-app
 * notification and outdated installations are flagged.
 */
import { execSync } from 'child_process'
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

const ALIASES = {
  web: '@paaq/web-sdk',
  'web-sdk': '@paaq/web-sdk',
  mcp: '@paaq/mcp-server',
  'mcp-server': '@paaq/mcp-server',
  server: '@paaq/server-sdk',
  'server-sdk': '@paaq/server-sdk',
  rn: '@paaq/react-native-sdk',
  'react-native': '@paaq/react-native-sdk',
  cli: '@paaq/cli',
}

function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')))
  const positional = argv.filter((a) => !a.startsWith('--'))
  const notesIdx = argv.indexOf('--notes')
  const releaseNotes = notesIdx >= 0 ? argv[notesIdx + 1] : undefined
  return {
    target: positional[0] ?? 'web',
    dryRun: flags.has('--dry-run'),
    skipPublish: flags.has('--skip-publish'),
    skipAnnounce: flags.has('--skip-announce'),
    releaseNotes,
  }
}

function run(cmd, cwd) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

function loadCatalog() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/sdk-versions.json'), 'utf8'))
}

function resolvePackages(target, catalog) {
  if (target === 'all') return Object.keys(catalog.packages)
  const npm = ALIASES[target] ?? target
  if (!catalog.packages[npm]) {
    console.error(`Unknown package "${target}". Known: ${Object.keys(catalog.packages).join(', ')}`)
    process.exit(1)
  }
  return [npm]
}

async function announceRelease(npmName, version, catalog, releaseNotes) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.REPO_CONNECTOR_INTERNAL_SECRET
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !secret) {
    console.warn(
      '\nSkipping announce-sdk-release: set SUPABASE_URL and REPO_CONNECTOR_INTERNAL_SECRET',
    )
    console.warn(
      '  Tip: vercel env pull apps/dashboard/.env.release.local --environment=production',
    )
    console.warn('  Then run: node scripts/announce-sdk-release.mjs web')
    return
  }
  if (!anonKey) {
    console.warn('\nSkipping announce-sdk-release: set NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return
  }

  const pkg = catalog.packages[npmName]
  const platforms = pkg.platforms ?? []

  const res = await fetch(`${supabaseUrl}/functions/v1/announce-sdk-release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      'x-internal-secret': secret,
    },
    body: JSON.stringify({
      package_name: npmName,
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
}

async function releaseOne(npmName, opts, catalog) {
  const pkg = catalog.packages[npmName]
  const cwd = path.join(ROOT, pkg.path)
  const version = pkg.version

  console.log(`\n=== Releasing ${npmName}@${version} ===`)

  if (pkg.build) {
    run(pkg.build, cwd)
  }

  run('npm pack --dry-run', cwd)

  if (opts.dryRun || opts.skipPublish) {
    console.log(`(skipping npm publish${opts.dryRun ? ' — dry-run' : ''})`)
  } else {
    run('npm publish --access public', cwd)
  }

  if (!opts.skipAnnounce && !opts.dryRun) {
    await announceRelease(npmName, version, catalog, opts.releaseNotes)
  }
}

const opts = parseArgs(process.argv.slice(2))

// Always sync versions first so every file matches the catalog.
run('node scripts/sync-sdk-versions.mjs', ROOT)

const catalog = loadCatalog()
const packages = resolvePackages(opts.target, catalog)

for (const npmName of packages) {
  await releaseOne(npmName, opts, catalog)
}

console.log('\nDone.')
