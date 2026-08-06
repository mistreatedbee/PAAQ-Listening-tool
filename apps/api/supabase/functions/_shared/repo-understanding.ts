/**
 * Pure heuristics for making sense of a repo's file tree and a handful of
 * fetched file contents — no Supabase client, no network I/O. The
 * onboard-agent edge function owns the actual `listTree`/`getFileContent`
 * calls against the git provider adapter (see ./git-providers/types.ts) and
 * passes their results in here; this module just decides what's worth
 * reading next and what those readings imply.
 */
import type { TreeEntry } from './git-providers/types.ts'

export type ProjectStructureCandidates = {
  /** Dirs that contain a package.json — provisionally "frontend", but a dir can
   *  also show up in candidateBackendDirs (e.g. a Node API) until file contents
   *  are actually read and disambiguate it. */
  candidateFrontendDirs: string[]
  /** Dirs that contain requirements.txt / go.mod / manage.py. */
  candidateBackendDirs: string[]
  /** Specific file paths worth fetching content for next. */
  candidateFiles: string[]
}

const MARKER_FILES = [
  'package.json',
  'requirements.txt',
  'go.mod',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.env.example',
  '.env.sample',
  'prisma/schema.prisma',
  'knexfile.js',
  'knexfile.ts',
  'manage.py',
]

const FRONTEND_MARKERS = new Set(['package.json'])
const BACKEND_MARKERS = new Set(['requirements.txt', 'go.mod', 'manage.py'])

const COMMON_SUBDIR_PREFIXES = ['frontend/', 'backend/', 'client/', 'server/', 'api/', 'apps/', 'packages/']

const MAX_CANDIDATE_FILES = 20

/** True if `dir` is the repo root, one of the common subdirs, or one level into apps/* or packages/*. */
function isOneLevelDeepOrRoot(dir: string): boolean {
  if (dir === '') return true
  for (const prefix of COMMON_SUBDIR_PREFIXES) {
    if (dir === prefix.slice(0, -1)) return true // e.g. dir === 'frontend'
    if (dir.startsWith(prefix)) {
      // one level into apps/* or packages/*, e.g. 'apps/web'
      const rest = dir.slice(prefix.length)
      if (rest !== '' && !rest.includes('/')) return true
    }
  }
  return false
}

/**
 * Scans a repo's file tree (paths only, no content) for well-known marker
 * files at the root and one level into common frontend/backend subdirs, and
 * proposes directories/files worth reading next. Never reads file content —
 * that's the caller's job once these candidates come back.
 */
export function identifyProjectStructure(entries: TreeEntry[]): ProjectStructureCandidates {
  const frontendDirs = new Set<string>()
  const backendDirs = new Set<string>()
  const candidateFiles: string[] = []

  for (const entry of entries) {
    if (entry.type !== 'file') continue

    const matchedMarker = MARKER_FILES.find((marker) => entry.path === marker || entry.path.endsWith('/' + marker))
    if (!matchedMarker) continue

    // Strip the marker's own suffix (which may itself contain a slash, e.g.
    // 'prisma/schema.prisma') to get the *project* dir it lives under, not
    // just its immediate parent — 'backend/prisma/schema.prisma' should
    // count as one level into 'backend', not into 'backend/prisma'.
    const dir = entry.path === matchedMarker ? '' : entry.path.slice(0, entry.path.length - matchedMarker.length - 1)
    if (!isOneLevelDeepOrRoot(dir)) continue

    const basename = matchedMarker.includes('/') ? matchedMarker.slice(matchedMarker.lastIndexOf('/') + 1) : matchedMarker
    if (FRONTEND_MARKERS.has(basename)) frontendDirs.add(dir)
    if (BACKEND_MARKERS.has(basename)) backendDirs.add(dir)

    if (candidateFiles.length < MAX_CANDIDATE_FILES) candidateFiles.push(entry.path)
  }

  return {
    candidateFrontendDirs: Array.from(frontendDirs),
    candidateBackendDirs: Array.from(backendDirs),
    candidateFiles: candidateFiles.slice(0, MAX_CANDIDATE_FILES),
  }
}

export type DbEngine = 'postgres' | 'mysql' | 'mongodb' | 'sqlite' | 'redis' | 'supabase'

export type DbConnectionCandidate = {
  engine: DbEngine
  varName?: string
  /** Only set when foundLiteralValue is true — a real-looking, non-placeholder value. */
  literalValue?: string
  foundLiteralValue: boolean
  sourceFile: string
}

const DB_KEY_PATTERN =
  /\b(DATABASE_URL|POSTGRES_URL|POSTGRESQL_URL|MYSQL_URL|MONGODB_URI|MONGO_URL|REDIS_URL|SQLITE_URL|TURSO_DATABASE_URL)\b\s*[:=]\s*(.*)/gi

const KEY_ENGINE_FALLBACK: Record<string, DbEngine> = {
  DATABASE_URL: 'postgres', // most common default in this ecosystem (Prisma/Rails-style convention); overridden by scheme when present
  POSTGRES_URL: 'postgres',
  POSTGRESQL_URL: 'postgres',
  MYSQL_URL: 'mysql',
  MONGODB_URI: 'mongodb',
  MONGO_URL: 'mongodb',
  REDIS_URL: 'redis',
  SQLITE_URL: 'sqlite',
  TURSO_DATABASE_URL: 'sqlite',
}

const SCHEME_ENGINE: [RegExp, DbEngine][] = [
  [/^postgres(?:ql)?:\/\//i, 'postgres'],
  [/^mysql:\/\//i, 'mysql'],
  [/^mongodb(?:\+srv)?:\/\//i, 'mongodb'],
  [/^rediss?:\/\//i, 'redis'],
  [/^(file:|libsql:\/\/)/i, 'sqlite'],
]

/**
 * Placeholder patterns treated as "not a real value" — anything that looks
 * like a template/example rather than a live credential. This list is
 * deliberately broad: it is far safer to under-detect a real secret (false
 * negative — the agent just asks the user to confirm the value instead of
 * assuming it) than to mistake a placeholder for a real one and act on it
 * (false positive — the agent could silently connect to, or report success
 * against, a fake/non-existent database). See DbConnectionCandidate's
 * foundLiteralValue: it must never be true unless the value is genuinely
 * plausible as a live secret.
 */
const PLACEHOLDER_PATTERNS = [
  /user:pass/i,
  /username:password/i,
  /<[^>]*>/, // <host>, <password>, etc.
  /xxx/i,
  /changeme/i,
  /your_/i,
  /example/i,
]

function looksLikePlaceholderLocalhost(value: string): boolean {
  if (!/localhost|127\.0\.0\.1/i.test(value)) return false
  // localhost alone isn't disqualifying (real local dev DBs exist), but
  // localhost combined with obviously-fake creds is.
  return /user:pass|username:password|test:test|admin:admin|root:root|xxx|changeme|your_|example/i.test(value)
}

/** Strips one layer of matching surrounding quotes, e.g. from a quoted YAML scalar. */
function stripQuotes(value: string): string {
  return value.replace(/^"([^"]*)"$/, '$1').replace(/^'([^']*)'$/, '$1')
}

function isPlaceholder(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') return true
  if (PLACEHOLDER_PATTERNS.some((p) => p.test(trimmed))) return true
  if (looksLikePlaceholderLocalhost(trimmed)) return true
  return false
}

function engineFromValue(value: string): DbEngine | null {
  for (const [scheme, engine] of SCHEME_ENGINE) {
    if (scheme.test(value)) return engine
  }
  return null
}

const PRISMA_PROVIDER_PATTERN = /^\s*provider\s*=\s*"(postgresql|postgres|mysql|sqlite|mongodb)"/im
const PRISMA_PROVIDER_ENGINE: Record<string, DbEngine> = {
  postgresql: 'postgres',
  postgres: 'postgres',
  mysql: 'mysql',
  sqlite: 'sqlite',
  mongodb: 'mongodb',
}

/**
 * Scans fetched file contents for database connection strings and returns
 * candidates for the agent to confirm with the user before acting on any of
 * them. Deliberately conservative: `foundLiteralValue` is only ever true for
 * a value that survives the placeholder checks in `isPlaceholder` — anything
 * ambiguous is reported as a var/engine hint with foundLiteralValue: false
 * rather than risk treating a placeholder as a real secret. Downstream, this
 * feeds a hard "never fabricate or assume a secret" requirement: a false
 * negative here just means the agent asks the user to paste/confirm the
 * value; a false positive would mean acting on a credential that was never
 * actually real.
 */
export function extractDbConnectionCandidates(
  files: { path: string; content: string }[],
): DbConnectionCandidate[] {
  const candidates: DbConnectionCandidate[] = []

  for (const file of files) {
    const isPrismaSchema = file.path.endsWith('prisma/schema.prisma') || file.path.endsWith('schema.prisma')

    if (isPrismaSchema) {
      const match = PRISMA_PROVIDER_PATTERN.exec(file.content)
      if (match) {
        const engine = PRISMA_PROVIDER_ENGINE[match[1].toLowerCase()]
        if (engine) {
          candidates.push({
            engine,
            foundLiteralValue: false,
            sourceFile: file.path,
          })
        }
      }
      continue
    }

    DB_KEY_PATTERN.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = DB_KEY_PATTERN.exec(file.content)) !== null) {
      const rawKey = match[1]
      const rawValue = stripQuotes((match[2] ?? '').split(/[\s#]/)[0]?.trim() ?? '')
      const key = rawKey.toUpperCase()

      const placeholder = isPlaceholder(rawValue)
      const engine = (!placeholder && engineFromValue(rawValue)) || KEY_ENGINE_FALLBACK[key]
      if (!engine) continue

      candidates.push({
        engine,
        varName: rawKey,
        literalValue: placeholder ? undefined : rawValue,
        foundLiteralValue: !placeholder,
        sourceFile: file.path,
      })
    }
  }

  return candidates
}
