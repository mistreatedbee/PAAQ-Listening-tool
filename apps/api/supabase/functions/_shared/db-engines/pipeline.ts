/**
 * Shared DB connect/introspect/verify-read-only pipeline and save logic —
 * used by both the db-connector edge function (Settings dashboard form,
 * paaq_connect_project MCP tool) and onboard-agent's configure_db_connection/
 * verify_database tools. One code path so onboard-agent never has to make an
 * HTTP call to db-connector from inside another edge function.
 */
// deno-lint-ignore no-explicit-any
type SupabaseClient = any

import { encryptSecret, parseDisplayHint } from '../crypto.ts'
import { categorizeError } from './types.ts'
import type { DbAdapter, TableInfo } from './types.ts'

export type Engine = 'postgres' | 'mysql' | 'mongodb' | 'sqlite' | 'redis' | 'supabase'

export type PipelineResult =
  | { ok: true; tables: TableInfo[] }
  | { ok: false; step: 'connect' | 'introspect' | 'readonly'; errorCategory: ReturnType<typeof categorizeError>; error: string }

// Lazily imported so a driver that fails to resolve in the deployed edge
// runtime (npm: specifiers for mysql2/mongodb/@libsql/redis have known
// compatibility gaps there) only breaks requests for that one engine,
// instead of crashing the whole function at module-load time.
export async function loadAdapter(engine: Engine): Promise<DbAdapter> {
  switch (engine) {
    case 'postgres':
    case 'supabase': // Supabase is Postgres under the hood
      return (await import('./postgres.ts')).postgresAdapter
    case 'mysql':
      return (await import('./mysql.ts')).mysqlAdapter
    case 'mongodb':
      return (await import('./mongodb.ts')).mongodbAdapter
    case 'sqlite': // "SQLite" here means libSQL/Turso — see libsql.ts
      return (await import('./libsql.ts')).libsqlAdapter
    case 'redis':
      return (await import('./redis.ts')).redisAdapter
    default:
      throw new Error(`Unsupported engine: ${engine}`)
  }
}

export async function runPipeline(engine: Engine, connectionString: string): Promise<PipelineResult> {
  let adapter: DbAdapter
  try {
    adapter = await loadAdapter(engine)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, step: 'connect', errorCategory: 'unsupported_engine', error: `This engine's driver is unavailable right now: ${msg.slice(0, 200)}` }
  }

  const connResult = await adapter.testConnection(connectionString)
  if (!connResult.ok) return { ok: false, step: 'connect', errorCategory: categorizeError(connResult.error), error: connResult.error }

  const introspectResult = await adapter.introspectSchema(connectionString)
  if (!introspectResult.ok) return { ok: false, step: 'introspect', errorCategory: categorizeError(introspectResult.error), error: introspectResult.error }

  const roResult = await adapter.verifyReadOnly(connectionString, introspectResult.tables)
  if (!roResult.ok) return { ok: false, step: 'readonly', errorCategory: categorizeError(roResult.error), error: roResult.error }

  return { ok: true, tables: introspectResult.tables }
}

/**
 * Re-verifies (never trusts a stale "it passed" claim) and, on success,
 * encrypts + persists the connection and feeds the existing
 * DATABASE_PLATFORMS/sdk_installations mechanism so "N/3 systems connected"
 * picks it up for free, with no separate status plumbing needed.
 */
export async function saveDbConnection(
  supabase: SupabaseClient,
  params: { projectId: string; tenantId: string; engine: Engine; connectionString: string },
): Promise<PipelineResult> {
  const { projectId, tenantId, engine, connectionString } = params
  const result = await runPipeline(engine, connectionString)
  if (!result.ok) return result

  const { ciphertext, iv } = await encryptSecret(connectionString)
  const hint = parseDisplayHint(engine, connectionString)
  const now = new Date().toISOString()

  await supabase.from('database_connectors').upsert(
    {
      project_id: projectId,
      engine,
      display_host: hint.host,
      display_database: hint.database,
      display_username: hint.username,
      ciphertext,
      iv,
      status: 'connected',
      last_test_at: now,
      last_test_ok: true,
      last_error: null,
      introspected_tables: result.tables,
      updated_at: now,
    },
    { onConflict: 'project_id' },
  )

  await supabase.from('sdk_installations').upsert(
    {
      tenant_id: tenantId,
      project_id: projectId,
      platform: engine,
      device_id: 'db-connector',
      sdk_version: '1.0.0',
      last_seen: now,
      status: 'active',
    },
    { onConflict: 'tenant_id,project_id,device_id,platform' },
  )

  try {
    const { syncKnowledgeRegistries } = await import('../knowledge-registry-engine.ts')
    await syncKnowledgeRegistries(supabase, projectId)
  } catch {
    /* non-fatal — connection is already saved */
  }

  return result
}
