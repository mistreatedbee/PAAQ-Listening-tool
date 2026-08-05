// deno-lint-ignore no-explicit-any
type SupabaseClient = any

// Accept both $ and non-$ prefixed variants — different SDK versions and
// integrations use both forms interchangeably.
const PAGE_VIEW_EVENTS = new Set(['$page_view', '$screen', 'page_view', 'screen_view', 'screen'])

type IncomingEventRow = {
  session_id: string | null
  event_name: string
  screen_name: string | null
  properties: Record<string, unknown>
  timestamp: string
}

/**
 * Maintains session_pages as a real page-by-page breakdown, driven by the
 * $page_view/$screen events every SDK already sends through /events — no
 * separate network call per navigation. For each session in the batch (in
 * timestamp order): closes the previously-open page when a new one starts,
 * and increments interaction_count on whichever page is open for every
 * other event.
 */
export async function recordPageViews(
  supabase: SupabaseClient,
  projectId: string,
  rows: IncomingEventRow[],
): Promise<void> {
  const bySession = new Map<string, IncomingEventRow[]>()
  for (const row of rows) {
    if (!row.session_id) continue
    if (!bySession.has(row.session_id)) bySession.set(row.session_id, [])
    bySession.get(row.session_id)!.push(row)
  }

  for (const [sessionId, sessionRows] of bySession) {
    sessionRows.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    const { data: openPageData } = await supabase
      .from('session_pages')
      .select('id, sequence, entered_at, interaction_count')
      .eq('session_id', sessionId)
      .is('exited_at', null)
      .maybeSingle()

    let open: { id: string; sequence: number; entered_at: string; interaction_count: number } | null = openPageData

    let maxSequence = open?.sequence ?? 0
    if (!open) {
      const { data: maxRow } = await supabase
        .from('session_pages')
        .select('sequence')
        .eq('session_id', sessionId)
        .order('sequence', { ascending: false })
        .limit(1)
        .maybeSingle()
      maxSequence = maxRow?.sequence ?? 0
    }

    for (const row of sessionRows) {
      if (PAGE_VIEW_EVENTS.has(row.event_name)) {
        const pagePath = String(
          row.properties?.page ?? row.properties?.name ?? row.screen_name ?? 'unknown',
        )

        if (open) {
          const durationMs = Math.max(0, new Date(row.timestamp).getTime() - new Date(open.entered_at).getTime())
          await supabase.from('session_pages')
            .update({ exited_at: row.timestamp, duration_ms: durationMs })
            .eq('id', open.id)
        }

        maxSequence += 1
        const { data: inserted } = await supabase.from('session_pages')
          .insert({
            project_id: projectId,
            session_id: sessionId,
            sequence: maxSequence,
            page_path: pagePath,
            entered_at: row.timestamp,
          })
          .select('id, entered_at')
          .single()

        open = inserted ? { id: inserted.id, sequence: maxSequence, entered_at: inserted.entered_at, interaction_count: 0 } : null
      } else if (open) {
        open.interaction_count += 1
        await supabase.from('session_pages')
          .update({ interaction_count: open.interaction_count })
          .eq('id', open.id)
      }
    }
  }
}

/**
 * Increments error_count on whichever session_pages row is currently open
 * for each error's session — called from the errors edge function after
 * inserting a batch, mirroring recordPageViews' interaction_count logic.
 */
export async function recordErrorsOnPages(
  supabase: SupabaseClient,
  rows: { session_id: string | null }[],
): Promise<void> {
  const sessionIds = [...new Set(rows.map((r) => r.session_id).filter((id): id is string => !!id))]

  for (const sessionId of sessionIds) {
    const { data: open } = await supabase
      .from('session_pages')
      .select('id, error_count')
      .eq('session_id', sessionId)
      .is('exited_at', null)
      .maybeSingle()

    if (!open) continue

    const count = rows.filter((r) => r.session_id === sessionId).length
    await supabase.from('session_pages')
      .update({ error_count: (open.error_count ?? 0) + count })
      .eq('id', open.id)
  }
}
