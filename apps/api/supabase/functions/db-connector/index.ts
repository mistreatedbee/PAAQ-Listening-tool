/**
 * PAAQ Database Connector — test, save, and status endpoints for a
 * project's read-only database connection. One code path for both the
 * Settings dashboard form and the paaq_connect_project MCP tool: both
 * authenticate with the same sdk_token + X-Project-ID scheme used by
 * every other public SDK-facing edge function in this repo.
 *
 * Actions:
 *   status     — non-secret connector summary for this project
 *   test       — dry-run: connect, introspect (names only), verify read-only
 *   save       — re-runs test, then encrypts + persists on success
 *   retest     — like test, but decrypts the already-stored connection string
 *   disconnect — soft-deletes the connector
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifySdkAuth } from '../_shared/auth.ts'
import { decryptSecret, encryptSecret, parseDisplayHint } from '../_shared/crypto.ts'
import { categorizeError } from '../_shared/db-engines/types.ts'
import type { DbAdapter, TableInfo } from '../_shared/db-engines/types.ts'
import { postgresAdapter } from '../_shared/db-engines/postgres.ts'
import { mysqlAdapter } from '../_shared/db-engines/mysql.ts'
import { mongodbAdapter } from '../_shared/db-engines/mongodb.ts'
import { libsqlAdapter } from '../_shared/db-engines/libsql.ts'
import { redisAdapter } from '../_shared/db-engines/redis.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

type Engine = 'postgres' | 'mysql' | 'mongodb' | 'sqlite' | 'redis' | 'supabase'

const ADAPTERS: Record<Engine, DbAdapter> = {
  postgres: postgresAdapter,
  supabase: postgresAdapter, // Supabase is Postgres under the hood
  mysql: mysqlAdapter,
  mongodb: mongodbAdapter,
  sqlite: libsqlAdapter, // "SQLite" here means libSQL/Turso — see libsql.ts
  redis: redisAdapter,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const auth = await verifySdkAuth(req, supabase)
  if (!auth.ok) return respond({ error: auth.error }, auth.status)

  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  try {
    if (action === 'status') return await handleStatus(auth.projectId)
    if (action === 'test') return await handleTest(body)
    if (action === 'save') return await handleSave(auth.projectId, auth.tenantId, body)
    if (action === 'retest') return await handleRetest(auth.projectId, auth.tenantId)
    if (action === 'disconnect') return await handleDisconnect(auth.projectId)
    return respond({ error: 'Unknown action' }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return respond({ ok: false, error: message }, 500)
  }
})

async function handleStatus(projectId: string): Promise<Response> {
  const { data } = await supabase
    .from('database_connectors')
    .select('engine, display_host, display_database, display_username, last_test_at, last_test_ok, introspected_tables')
    .eq('project_id', projectId)
    .eq('status', 'connected')
    .maybeSingle()

  if (!data) return respond({ connected: false })

  const tableCount = Array.isArray(data.introspected_tables) ? data.introspected_tables.length : 0
  return respond({
    connected: true,
    engine: data.engine,
    displayHost: data.display_host,
    displayDatabase: data.display_database,
    displayUsername: data.display_username,
    lastTestAt: data.last_test_at,
    lastTestOk: data.last_test_ok,
    tableCount,
  })
}

type PipelineResult =
  | { ok: true; tables: TableInfo[] }
  | { ok: false; step: 'connect' | 'introspect' | 'readonly'; errorCategory: ReturnType<typeof categorizeError>; error: string }

async function runPipeline(engine: Engine, connectionString: string): Promise<PipelineResult> {
  const adapter = ADAPTERS[engine]
  if (!adapter) {
    return { ok: false, step: 'connect', errorCategory: 'unsupported_engine', error: `Unsupported engine: ${engine}` }
  }

  const connResult = await adapter.testConnection(connectionString)
  if (!connResult.ok) return { ok: false, step: 'connect', errorCategory: categorizeError(connResult.error), error: connResult.error }

  const introspectResult = await adapter.introspectSchema(connectionString)
  if (!introspectResult.ok) return { ok: false, step: 'introspect', errorCategory: categorizeError(introspectResult.error), error: introspectResult.error }

  const roResult = await adapter.verifyReadOnly(connectionString, introspectResult.tables)
  if (!roResult.ok) return { ok: false, step: 'readonly', errorCategory: categorizeError(roResult.error), error: roResult.error }

  return { ok: true, tables: introspectResult.tables }
}

async function handleTest(body: Record<string, unknown>): Promise<Response> {
  const engine = body.engine as Engine
  const connectionString = body.connectionString as string
  if (!engine) return respond({ ok: false, errorCategory: 'unsupported_engine', error: 'engine is required' }, 400)
  if (!connectionString) return respond({ ok: false, error: 'connectionString is required' }, 400)

  const result = await runPipeline(engine, connectionString)
  if (!result.ok) return respond(result)

  return respond({
    ok: true,
    tableCount: result.tables.length,
    tables: result.tables.map((t) => ({ name: t.name, columns: t.columns })),
  })
}

async function handleSave(projectId: string, tenantId: string, body: Record<string, unknown>): Promise<Response> {
  const engine = body.engine as Engine
  const connectionString = body.connectionString as string
  if (!engine) return respond({ ok: false, errorCategory: 'unsupported_engine', error: 'engine is required' }, 400)
  if (!connectionString) return respond({ ok: false, error: 'connectionString is required' }, 400)

  // Never trust a stale client-side "it passed" state — always re-verify
  // server-side right before persisting anything.
  const result = await runPipeline(engine, connectionString)
  if (!result.ok) return respond(result)

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

  // Feed the existing app-wide connected-status mechanism (DATABASE_PLATFORMS
  // in connected-app-context.tsx) so "N/3 systems connected" reflects this
  // for free, with no separate status plumbing needed elsewhere.
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

  return handleStatus(projectId)
}

async function handleRetest(projectId: string, tenantId: string): Promise<Response> {
  const { data } = await supabase
    .from('database_connectors')
    .select('engine, ciphertext, iv')
    .eq('project_id', projectId)
    .single()

  if (!data) return respond({ ok: false, error: 'No database connector configured for this project' }, 404)

  const connectionString = await decryptSecret(data.ciphertext, data.iv)
  const result = await runPipeline(data.engine as Engine, connectionString)
  const now = new Date().toISOString()

  await supabase.from('database_connectors').update({
    last_test_at: now,
    last_test_ok: result.ok,
    last_error: result.ok ? null : result.error,
    ...(result.ok ? { introspected_tables: result.tables } : {}),
    updated_at: now,
  }).eq('project_id', projectId)

  if (!result.ok) return respond(result)

  await supabase.from('sdk_installations').upsert(
    {
      tenant_id: tenantId,
      project_id: projectId,
      platform: data.engine,
      device_id: 'db-connector',
      sdk_version: '1.0.0',
      last_seen: now,
      status: 'active',
    },
    { onConflict: 'tenant_id,project_id,device_id,platform' },
  )

  return handleStatus(projectId)
}

async function handleDisconnect(projectId: string): Promise<Response> {
  await supabase.from('database_connectors')
    .update({ status: 'disabled', updated_at: new Date().toISOString() })
    .eq('project_id', projectId)
  return respond({ ok: true })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-project-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}
