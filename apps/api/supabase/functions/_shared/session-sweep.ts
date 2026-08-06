/**
 * Closes sessions that went silent without an explicit end call — the same
 * real classification session-sweep-cron performs on a timer, but callable
 * inline for one project. Used by events/index.ts so a project's own real
 * traffic can sweep its own stale sessions, since Deno.cron scheduling is
 * not a reliable signal on its own (no long-lived process guarantees it
 * actually fires — see db-heartbeat.ts, which exists for the same reason).
 *
 * Real classification, not a synthetic timestamp bump: a session with zero
 * interactions ever is 'abandoned'; one that had real activity and then went
 * quiet is 'timed_out'.
 */
import { withRetryResult } from './retry.ts'
import { closeSession } from './session-close.ts'

// deno-lint-ignore no-explicit-any
type SupabaseClient = any

const IDLE_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes with no new events

/**
 * Sweeps this project's own stale-active sessions. Skips silently if it was
 * already checked within `minIntervalMs` — so a burst of real traffic can't
 * hammer the sessions table with sweep queries.
 */
export async function checkAndSweepStaleSessions(
  supabase: SupabaseClient,
  projectId: string,
  minIntervalMs = 10 * 60 * 1000,
): Promise<void> {
  const { data: project } = await supabase
    .from('tenant_projects')
    .select('id, sessions_last_swept_at')
    .eq('id', projectId)
    .maybeSingle()

  if (!project) return
  if (
    project.sessions_last_swept_at &&
    Date.now() - new Date(project.sessions_last_swept_at).getTime() < minIntervalMs
  ) {
    return
  }

  const now = new Date().toISOString()
  // Stamp the throttle first — even if the sweep below fails partway through,
  // the next real request will retry it after minIntervalMs rather than
  // hammering the DB on every single event batch in the meantime.
  await withRetryResult(() =>
    supabase.from('tenant_projects').update({ sessions_last_swept_at: now }).eq('id', projectId),
  )

  const cutoff = new Date(Date.now() - IDLE_THRESHOLD_MS).toISOString()

  const { data: sessions, error } = await withRetryResult(() =>
    supabase.from('sessions')
      .select('id, project_id, started_at, interaction_count')
      .eq('project_id', projectId)
      .eq('status', 'active')
      .is('ended_at', null)
      .lt('started_at', cutoff),
  )

  if (error || !sessions) {
    console.error(`session-sweep: failed to load sessions for project ${projectId}`, error)
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
      console.error(`session-sweep: failed to close session ${session.id}`, err)
    }
  }
}
