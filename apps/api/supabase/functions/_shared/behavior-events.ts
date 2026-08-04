// deno-lint-ignore no-explicit-any
type SupabaseClient = any

type IncomingEventRow = {
  session_id: string | null
  event_name: string
  properties: Record<string, unknown> | null
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
  const maxScrollBySession = new Map<string, number>()
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
      const prev = maxScrollBySession.get(row.session_id) ?? 0
      if (pct > prev) maxScrollBySession.set(row.session_id, pct)
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

  for (const [sessionId, pct] of maxScrollBySession) {
    const { data: openPage } = await supabase
      .from('session_pages')
      .select('id, scroll_depth_pct')
      .eq('session_id', sessionId)
      .is('exited_at', null)
      .maybeSingle()
    if (openPage && (openPage.scroll_depth_pct ?? 0) < pct) {
      await supabase.from('session_pages').update({ scroll_depth_pct: pct }).eq('id', openPage.id)
    }
  }

  if (formFieldRows.length > 0) {
    await supabase.from('form_field_stats').insert(formFieldRows)
  }
}
