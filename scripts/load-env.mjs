import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Placeholder written when env pull tools redact secrets — never use as a real value. */
function isPlaceholder(val) {
  const v = val.trim()
  return !v || v === '[SENSITIVE]' || v === 'your-internal-secret'
}

/**
 * Load KEY=VALUE lines from a gitignored env file.
 * @param {string} rel path relative to repo root
 * @param {boolean} override replace existing process.env entries
 */
export function loadEnvFile(rel, override = false) {
  const file = path.join(ROOT, rel)
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1).trim()
    }
    if (isPlaceholder(val)) continue
    if (!process.env[key] || override) process.env[key] = val
  }
}

/** Load env for SDK release/announce scripts (repo root wins). */
export function loadSdkReleaseEnv() {
  loadEnvFile('apps/dashboard/.env.local')
  loadEnvFile('apps/dashboard/.env.release.local')
  loadEnvFile('.env.local', true)
}

export { ROOT }
