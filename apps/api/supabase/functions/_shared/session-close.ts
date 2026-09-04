// deno-lint-ignore no-explicit-any
type SupabaseClient = any

const IDLE_GAP_THRESHOLD_MS = 60_000 // gaps between events longer than this count as idle time, not active time

export type SessionOutcome = 'completed' | 'abandoned' | 'timed_out' | 'logged_out' | 'crashed' | 'force_closed'

export type CloseSessionResult =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * Computes real, derived session-close stats from the session's actual events
 * (active/idle time via event-to-event gap bucketing, time-to-first-interaction,
 * page/interaction counts), closes any dangling open session_pages row, and
 * writes the final sessions row. Shared by the sessions edge function's
 * `action:'end'` and the session-sweep-cron, so this math lives in one place.
 */
export async function closeSession(
  supabase: SupabaseClient,
  params: {
    sessionId: string
    projectId: string
    startedAt: string
    outcome: SessionOutcome
    endedAt?: string
  },
): Promise<CloseSessionResult> {
  const { sessionId, projectId, startedAt, outcome } = params
  const endedAt = params.endedAt ?? new Date().toISOString()

  const [{ data: events }, { count: pageCount }] = await Promise.all([
    supabase.from('events').select('timestamp').eq('session_id', sessionId).order('timestamp', { ascending: true }),
    supabase.from('session_pages').select('*', { count: 'exact', head: true }).eq('session_id', sessionId),
  ])

  const timestamps: number[] = (events ?? []).map((e: { timestamp: string }) => new Date(e.timestamp).getTime())
  const startMs = new Date(startedAt).getTime()
  const endMs = new Date(endedAt).getTime()

  let activeSeconds = 0
  if (timestamps.length > 0) {
    let prev = startMs
    for (const ts of timestamps) {
      const gap = ts - prev
      if (gap > 0 && gap <= IDLE_GAP_THRESHOLD_MS) activeSeconds += gap / 1000
      prev = ts
    }
  }
  const durationSeconds = Math.max(0, Math.round((endMs - startMs) / 1000))
  activeSeconds = Math.min(Math.round(activeSeconds), durationSeconds)
  const idleSeconds = Math.max(0, durationSeconds - activeSeconds)

  const timeToFirstInteractionMs = timestamps.length > 0 ? Math.max(0, timestamps[0] - startMs) : null

  // Close any page-visit row still open for this session.
  const { data: openPage } = await supabase
    .from('session_pages')
    .select('id, entered_at')
    .eq('session_id', sessionId)
    .is('exited_at', null)
    .maybeSingle()

  if (openPage) {
    const durationMs = Math.max(0, endMs - new Date(openPage.entered_at).getTime())
    await supabase.from('session_pages').update({ exited_at: endedAt, duration_ms: durationMs }).eq('id', openPage.id)
  }

  const { error } = await supabase
    .from('sessions')
    .update({
      status:
        outcome === 'abandoned' || outcome === 'timed_out' || outcome === 'force_closed'
          ? 'abandoned'
          : 'completed',
      ended_at: endedAt,
      duration: durationSeconds,
      outcome,
      active_seconds: activeSeconds,
      idle_seconds: idleSeconds,
      time_to_first_interaction_ms: timeToFirstInteractionMs,
      page_count: pageCount ?? 0,
      interaction_count: timestamps.length,
    })
    .eq('id', sessionId)
    .eq('project_id', projectId)

  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}
