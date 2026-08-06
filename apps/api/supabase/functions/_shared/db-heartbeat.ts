/**
 * Single-project database liveness check — the same real `testConnection`
 * logic db-heartbeat-cron sweeps on a timer, but callable inline for one
 * project. Used by events/index.ts to advance the Database SDK's last_seen
 * from real website traffic, since the cron schedule is not a reliable
 * signal on its own (no long-lived process guarantees it actually fires).
 */
import { decryptSecret } from './crypto.ts'
import { withRetryResult } from './retry.ts'
import type { DbAdapter } from './db-engines/types.ts'

// deno-lint-ignore no-explicit-any
type SupabaseClient = any

type Engine = 'postgres' | 'mysql' | 'mongodb' | 'sqlite' | 'redis' | 'supabase'

async function loadAdapter(engine: Engine): Promise<DbAdapter> {
  switch (engine) {
    case 'postgres':
    case 'supabase':
      return (await import('./db-engines/postgres.ts')).postgresAdapter
    case 'mysql':
      return (await import('./db-engines/mysql.ts')).mysqlAdapter
    case 'mongodb':
      return (await import('./db-engines/mongodb.ts')).mongodbAdapter
    case 'sqlite':
      return (await import('./db-engines/libsql.ts')).libsqlAdapter
    case 'redis':
      return (await import('./db-engines/redis.ts')).redisAdapter
    default:
      throw new Error(`Unsupported engine: ${engine}`)
  }
}

/**
 * Re-tests this project's connected database and advances last_seen on
 * success. Skips silently if there's no connected connector, or if it was
 * already checked within `minIntervalMs` — so a burst of real traffic can't
 * hammer a customer's database with connection attempts.
 */
export async function checkAndRecordDbHeartbeat(
  supabase: SupabaseClient,
  projectId: string,
  minIntervalMs = 20 * 60 * 1000,
): Promise<void> {
  const { data: row, error: selectError } = await supabase
    .from('database_connectors')
    .select('project_id, engine, ciphertext, iv, consecutive_failures, last_test_at, tenant_projects!inner(tenant_id)')
    .eq('project_id', projectId)
    .eq('status', 'connected')
    .maybeSingle()

  // A failed select (e.g. a column that doesn't actually exist live) must
  // not be treated the same as "this project has no connected database" —
  // that exact silent conflation is why this heartbeat never advanced for
  // months despite constant real traffic. Log it loudly instead.
  if (selectError) {
    console.error(`db-heartbeat: select failed for project ${projectId}`, selectError)
    return
  }
  if (!row) return
  if (row.last_test_at && Date.now() - new Date(row.last_test_at).getTime() < minIntervalMs) return

  const tenantId = (row.tenant_projects as unknown as { tenant_id: string }).tenant_id
  const now = new Date().toISOString()

  try {
    const adapter = await loadAdapter(row.engine as Engine)
    const connectionString = await decryptSecret(row.ciphertext, row.iv)
    const startedAt = Date.now()
    const result = await adapter.testConnection(connectionString)
    const latencyMs = Date.now() - startedAt

    await withRetryResult(() =>
      supabase.from('database_connectors').update({
        last_test_at: now,
        last_test_ok: result.ok,
        last_error: result.ok ? null : result.error,
        last_latency_ms: latencyMs,
        consecutive_failures: result.ok ? 0 : (row.consecutive_failures ?? 0) + 1,
        updated_at: now,
      }).eq('project_id', projectId),
    )

    if (result.ok) {
      const { data: updated, error: updateError } = await supabase
        .from('sdk_installations')
        .update({ last_seen: now, status: 'active' })
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .eq('device_id', 'db-connector')
        .eq('platform', row.engine)
        .select('id')

      if (updateError) {
        console.error(`db-heartbeat: sdk_installations update failed for project ${projectId}`, updateError)
      } else if (!updated || updated.length === 0) {
        const { error: insertError } = await supabase.from('sdk_installations').insert({
          tenant_id: tenantId,
          project_id: projectId,
          platform: row.engine,
          device_id: 'db-connector',
          sdk_version: '1.0.0',
          last_seen: now,
          status: 'active',
        })
        if (insertError) {
          console.error(`db-heartbeat: sdk_installations insert failed for project ${projectId}`, insertError)
        }
      }
    }
  } catch (err) {
    console.error(`db-heartbeat: check failed for project ${projectId}`, err)
  }
}
