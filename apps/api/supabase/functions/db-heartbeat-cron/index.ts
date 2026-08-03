/**
 * PAAQ Database Heartbeat — scheduled, genuine liveness check for every
 * connected database. Runs a real `testConnection` against each project's
 * stored (decrypted) connection string and only advances `last_seen` in
 * sdk_installations when that connection actually succeeds. No synthetic
 * timers, no unconditional timestamp bumps — see the removal of the old
 * fake pg_cron heartbeat in migrate-once/index.ts for why that matters here.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withRetryResult } from '../_shared/retry.ts'
import { checkAndRecordDbHeartbeat } from '../_shared/db-heartbeat.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function checkInternalSecret(req: Request): boolean {
  const provided = req.headers.get('x-internal-secret') ?? ''
  const expected = Deno.env.get('REPO_CONNECTOR_INTERNAL_SECRET') ?? ''
  return expected.length > 0 && provided === expected
}

/**
 * Backstop sweep for projects with no live website traffic to trigger the
 * inline per-request check in events/index.ts — e.g. a backend-only
 * integration, or a site with no visitors since the last check. Passing
 * minIntervalMs: 0 forces a real re-check regardless of last_test_at,
 * since this function's own schedule is already the throttle.
 */
async function runHeartbeatSweep() {
  const { data: connectors, error } = await withRetryResult(() =>
    supabase
      .from('database_connectors')
      .select('project_id')
      .eq('status', 'connected'),
  )

  if (error || !connectors) {
    console.error('db-heartbeat-cron: failed to load connectors', error)
    return
  }

  for (const row of connectors) {
    await checkAndRecordDbHeartbeat(supabase, row.project_id, 0)
  }
}

// Every 30 minutes — frequent enough to keep the 25h "connected" window
// meaningful, infrequent enough not to hammer customer databases. Runs
// alongside (not instead of) the per-request check in events/index.ts,
// since Deno.cron scheduling isn't guaranteed to be enabled on every
// deployment target — this is the backstop, not the primary signal.
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
