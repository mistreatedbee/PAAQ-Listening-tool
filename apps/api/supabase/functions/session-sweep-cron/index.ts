/**
 * Closes sessions that went silent without an explicit end call — the only
 * way a web/RN/iOS/Android session reliably gets an outcome today, since
 * hard app-kills and network loss can't always be intercepted client-side
 * (see apps/sdk-web/src/index.ts's endSession + the Flutter/RN/iOS/Android
 * plan notes). Real classification, not a synthetic timestamp bump: a
 * session with zero interactions ever is 'abandoned'; one that had real
 * activity and then went quiet is 'timed_out'.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withRetryResult } from '../_shared/retry.ts'
import { closeSession } from '../_shared/session-close.ts'

const IDLE_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes with no new events

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function checkInternalSecret(req: Request): boolean {
  const provided = req.headers.get('x-internal-secret') ?? ''
  const expected = Deno.env.get('REPO_CONNECTOR_INTERNAL_SECRET') ?? ''
  return expected.length > 0 && provided === expected
}

async function runSweep() {
  const cutoff = new Date(Date.now() - IDLE_THRESHOLD_MS).toISOString()

  const { data: sessions, error } = await withRetryResult(() =>
    supabase.from('sessions')
      .select('id, project_id, started_at, interaction_count')
      .eq('status', 'active')
      .is('ended_at', null)
      .lt('started_at', cutoff),
  )

  if (error || !sessions) {
    console.error('session-sweep-cron: failed to load sessions', error)
    return
  }

  for (const session of sessions) {
    try {
      // A session can have real activity after started_at but before the
      // cutoff — only sweep ones with no recent events either.
      const { count: recentEvents } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .gt('timestamp', cutoff)

      if ((recentEvents ?? 0) > 0) continue // still genuinely active, leave it alone

      const { count: everHadInteractions } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session.id)

      const outcome = (everHadInteractions ?? 0) > 0 ? 'timed_out' : 'abandoned'

      await closeSession(supabase, {
        sessionId: session.id,
        projectId: session.project_id,
        startedAt: session.started_at,
        outcome,
      })
    } catch (err) {
      console.error(`session-sweep-cron: failed to close session ${session.id}`, err)
    }
  }
}

// Every 15 minutes — matches generate-insights-cron's cadence; idle sessions
// don't need faster detection than that.
Deno.cron('session-sweep', '*/15 * * * *', runSweep)

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
