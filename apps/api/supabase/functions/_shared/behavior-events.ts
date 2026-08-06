// deno-lint-ignore no-explicit-any
type SupabaseClient = any

type IncomingEventRow = {
  session_id: string | null
  event_name: string
  properties: Record<string, unknown> | null
  timestamp?: string
}

/**
 * Handles the behavior-analytics event vocabulary shared by every SDK
 * (web click/tap, native tap — same event names either way):
 *   $rage_click   — repeated clicks/taps in quick succession, same spot
 *   $dead_click   — a click/tap that produced no further tracked signal
 *   $scroll_depth — { pct } milestone, tracked as the session_page's max
 *   $form_field   — one row per field interaction, → form_field_stats
 *   $form_abandon — a touched form left without submitting
 *
 * All counts/rows come only from what the SDK actually observed — nothing
 * inferred server-side beyond simple max/sum aggregation.
 */
export async function recordBehaviorEvents(
  supabase: SupabaseClient,
  projectId: string,
  rows: IncomingEventRow[],
): Promise<void> {
  const sessionDeltas = new Map<string, { rage: number; dead: number; formAbandon: number }>()
  // Keyed by session — each entry keeps the max pct seen *and* the page/time
  // it happened on, so it can be attributed to the right session_pages row
  // below instead of "whichever page happens to be open right now" (same
  // fragile-matching bug fixed for errors in session-pages.ts).
  const maxScrollBySession = new Map<string, { pct: number; page: string | null; timestamp: string }>()
  const formFieldRows: Record<string, unknown>[] = []

  for (const row of rows) {
    if (!row.session_id) continue
    const props = row.properties ?? {}

    if (row.event_name === '$rage_click' || row.event_name === '$dead_click' || row.event_name === '$form_abandon') {
      const delta = sessionDeltas.get(row.session_id) ?? { rage: 0, dead: 0, formAbandon: 0 }
      if (row.event_name === '$rage_click') delta.rage += 1
      else if (row.event_name === '$dead_click') delta.dead += 1
      else delta.formAbandon += 1
      sessionDeltas.set(row.session_id, delta)
    } else if (row.event_name === '$scroll_depth') {
      const pct = Math.max(0, Math.min(100, Number(props.pct ?? 0)))
      const prev = maxScrollBySession.get(row.session_id)
      if (!prev || pct > prev.pct) {
        maxScrollBySession.set(row.session_id, {
          pct,
          page: typeof props.page === 'string' ? props.page : null,
          timestamp: row.timestamp ?? new Date().toISOString(),
        })
      }
    } else if (row.event_name === '$form_field') {
      formFieldRows.push({
        project_id: projectId,
        session_id: row.session_id,
        page_path: String(props.page ?? ''),
        form_name: props.formName ?? null,
        field_name: String(props.fieldName ?? 'unknown'),
        time_spent_ms: typeof props.timeSpentMs === 'number' ? props.timeSpentMs : null,
        backspace_count: typeof props.backspaceCount === 'number' ? props.backspaceCount : 0,
        had_error: Boolean(props.hadError),
        completed: Boolean(props.completed),
      })
    }
  }

  for (const [sessionId, delta] of sessionDeltas) {
    if (!delta.rage && !delta.dead && !delta.formAbandon) continue
    const { data: current } = await supabase
      .from('sessions')
      .select('rage_click_count, dead_click_count, form_abandon_count')
      .eq('id', sessionId)
      .maybeSingle()
    if (!current) continue
    await supabase.from('sessions').update({
      rage_click_count: (current.rage_click_count ?? 0) + delta.rage,
      dead_click_count: (current.dead_click_count ?? 0) + delta.dead,
      form_abandon_count: (current.form_abandon_count ?? 0) + delta.formAbandon,
    }).eq('id', sessionId)
  }

  for (const [sessionId, scroll] of maxScrollBySession) {
    const { data: pages } = await supabase
      .from('session_pages')
      .select('id, page_path, entered_at, exited_at, scroll_depth_pct')
      .eq('session_id', sessionId)
      .order('entered_at', { ascending: true })
    if (!pages || pages.length === 0) continue

    const scrollMs = new Date(scroll.timestamp).getTime()
    // deno-lint-ignore no-explicit-any
    let match = (pages as any[]).find((p) => {
      if (scroll.page == null || p.page_path !== scroll.page) return false
      const enteredMs = new Date(p.entered_at).getTime()
      const exitedMs = p.exited_at ? new Date(p.exited_at).getTime() : Infinity
      return scrollMs >= enteredMs && scrollMs < exitedMs
    })
    // deno-lint-ignore no-explicit-any
    if (!match) match = (pages as any[]).find((p) => p.exited_at == null)
    if (match && (match.scroll_depth_pct ?? 0) < scroll.pct) {
      await supabase.from('session_pages').update({ scroll_depth_pct: scroll.pct }).eq('id', match.id)
    }
  }

  if (formFieldRows.length > 0) {
    await supabase.from('form_field_stats').insert(formFieldRows)
  }
}
