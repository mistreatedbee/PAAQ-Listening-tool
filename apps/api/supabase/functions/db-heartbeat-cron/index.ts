/**
 * PAAQ Database Heartbeat — scheduled, genuine liveness check for every
 * connected database. Runs a real `testConnection` against each project's
 * stored (decrypted) connection string and only advances `last_seen` in
 * sdk_installations when that connection actually succeeds. No synthetic
 * timers, no unconditional timestamp bumps — see the removal of the old
 * fake pg_cron heartbeat in migrate-once/index.ts for why that matters here.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decryptSecret } from '../_shared/crypto.ts'
import { withRetryResult } from '../_shared/retry.ts'
import type { DbAdapter } from '../_shared/db-engines/types.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function checkInternalSecret(req: Request): boolean {
  const provided = req.headers.get('x-internal-secret') ?? ''
  const expected = Deno.env.get('REPO_CONNECTOR_INTERNAL_SECRET') ?? ''
  return expected.length > 0 && provided === expected
}

type Engine = 'postgres' | 'mysql' | 'mongodb' | 'sqlite' | 'redis' | 'supabase'

async function loadAdapter(engine: Engine): Promise<DbAdapter> {
  switch (engine) {
    case 'postgres':
    case 'supabase':
      return (await import('../_shared/db-engines/postgres.ts')).postgresAdapter
    case 'mysql':
      return (await import('../_shared/db-engines/mysql.ts')).mysqlAdapter
    case 'mongodb':
      return (await import('../_shared/db-engines/mongodb.ts')).mongodbAdapter
    case 'sqlite':
      return (await import('../_shared/db-engines/libsql.ts')).libsqlAdapter
    case 'redis':
      return (await import('../_shared/db-engines/redis.ts')).redisAdapter
    default:
      throw new Error(`Unsupported engine: ${engine}`)
  }
}

async function runHeartbeatSweep() {
  const { data: connectors, error } = await withRetryResult(() =>
    supabase
      .from('database_connectors')
      .select('project_id, engine, ciphertext, iv, consecutive_failures, tenant_projects!inner(tenant_id)')
      .eq('status', 'connected'),
  )

  if (error || !connectors) {
    console.error('db-heartbeat-cron: failed to load connectors', error)
    return
  }

  for (const row of connectors) {
    const now = new Date().toISOString()
    const tenantId = (row.tenant_projects as unknown as { tenant_id: string }).tenant_id
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
        }).eq('project_id', row.project_id),
      )

      // Only real, successful connections advance the liveness signal that
      // the dashboard's Connection Status panel reads from.
      if (result.ok) {
        await supabase.from('sdk_installations').upsert(
          {
            tenant_id: tenantId,
            project_id: row.project_id,
            platform: row.engine,
            device_id: 'db-connector',
            sdk_version: '1.0.0',
            last_seen: now,
            status: 'active',
          },
          { onConflict: 'tenant_id,project_id,device_id,platform' },
        )
      }
    } catch (err) {
      console.error(`db-heartbeat-cron: check failed for project ${row.project_id}`, err)
    }
  }
}

// Every 30 minutes — frequent enough to keep the 25h "connected" window
// meaningful, infrequent enough not to hammer customer databases.
Deno.cron('db-connector-heartbeat', '*/30 * * * *', runHeartbeatSweep)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  // Manual trigger for testing/ops — same real-check code path as the cron,
  // gated behind the internal secret so it can't be used to probe customer DBs.
  if (!checkInternalSecret(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...cors() },
    })
  }
  await runHeartbeatSweep()
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
})

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
