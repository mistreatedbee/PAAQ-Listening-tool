/**
 * PAAQ Continuous AI Learning sweep — periodically checks each active
 * project for genuinely new telemetry (events/errors/performance_metrics
 * since that project's last processed watermark) and, only when new data
 * exists, invokes the existing `analyze` function (the same pipeline the
 * dashboard's "Run AI Analysis" button already calls) to refresh insights,
 * feature health, journeys, and anomalies.
 *
 * This does no work and writes nothing for a project with no new data —
 * the watermark only advances after a real, successful analysis run. Same
 * "only advance state on a genuine check" discipline as db-heartbeat-cron.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withRetryResult } from '../_shared/retry.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function checkInternalSecret(req: Request): boolean {
  const provided = req.headers.get('x-internal-secret') ?? ''
  const expected = Deno.env.get('REPO_CONNECTOR_INTERNAL_SECRET') ?? ''
  return expected.length > 0 && provided === expected
}

async function hasNewData(projectId: string, since: string): Promise<boolean> {
  const [{ count: eventCount }, { count: errorCount }, { count: perfCount }] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true })
      .eq('project_id', projectId).gt('timestamp', since),
    supabase.from('errors').select('id', { count: 'exact', head: true })
      .eq('project_id', projectId).gt('created_at', since),
    supabase.from('performance_metrics').select('id', { count: 'exact', head: true })
      .eq('project_id', projectId).gt('created_at', since),
  ])
  return (eventCount ?? 0) > 0 || (errorCount ?? 0) > 0 || (perfCount ?? 0) > 0
}

async function runSweep() {
  const { data: projects, error } = await withRetryResult(() =>
    supabase.from('tenant_projects').select('id').eq('status', 'active'),
  )
  if (error || !projects) {
    console.error('generate-insights-cron: failed to load projects', error)
    return
  }

  for (const { id: projectId } of projects) {
    try {
      const { data: watermark } = await supabase
        .from('ai_processing_state')
        .select('last_processed_at')
        .eq('project_id', projectId)
        .maybeSingle()
      const since = watermark?.last_processed_at ?? '1970-01-01T00:00:00Z'

      const newData = await hasNewData(projectId, since)
      if (!newData) continue // no genuine new data — no AI call, no write

      const { error: invokeError } = await supabase.functions.invoke('analyze', {
        body: { project_id: projectId },
      })
      if (invokeError) {
        console.error(`generate-insights-cron: analyze failed for ${projectId}`, invokeError)
        continue // do not advance the watermark on a failed run
      }

      // Watermark only advances after a real, successful analysis run.
      await supabase.from('ai_processing_state').upsert({
        project_id: projectId,
        last_processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error(`generate-insights-cron: sweep failed for ${projectId}`, err)
    }
  }
}

// Every 15 minutes — frequent enough to feel continuous without hammering
// Claude on projects with no new traffic (those are skipped entirely above).
Deno.cron('generate-insights-sweep', '*/15 * * * *', runSweep)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  if (!checkInternalSecret(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...cors() },
    })
  }
  await runSweep()
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
