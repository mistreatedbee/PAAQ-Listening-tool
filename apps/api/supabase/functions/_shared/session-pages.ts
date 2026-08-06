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
 * Attributes each error to the real session_pages row it happened on —
 * matched by page_path === error.screen AND the error's timestamp falling
 * within that page's [entered_at, exited_at ?? now) window, not just
 * "whichever page happens to be open right now." The naive open-page-only
 * version silently dropped the count whenever no page-view had fired yet,
 * the page had already closed, or the errors/events batches raced each
 * other — even though errors.screen already has the correct page tagged at
 * capture time (see apps/sdk-web/src/index.ts's sendError()). Falls back to
 * the currently-open page only when no page_path match exists at all, so a
 * genuinely un-attributable error (e.g. no page_view ever sent) still isn't
 * silently lost if there's at least one open page to charge it to.
 */
export async function recordErrorsOnPages(
  supabase: SupabaseClient,
  rows: { session_id: string | null; screen: string | null; created_at: string }[],
): Promise<void> {
  const bySession = new Map<string, { screen: string | null; created_at: string }[]>()
  for (const row of rows) {
    if (!row.session_id) continue
    if (!bySession.has(row.session_id)) bySession.set(row.session_id, [])
    bySession.get(row.session_id)!.push({ screen: row.screen, created_at: row.created_at })
  }

  for (const [sessionId, sessionErrors] of bySession) {
    const { data: pages } = await supabase
      .from('session_pages')
      .select('id, page_path, entered_at, exited_at, error_count')
      .eq('session_id', sessionId)
      .order('entered_at', { ascending: true })

    if (!pages || pages.length === 0) continue

    const deltas = new Map<string, number>()
    for (const err of sessionErrors) {
      const errMs = new Date(err.created_at).getTime()
      // deno-lint-ignore no-explicit-any
      let match = (pages as any[]).find((p) => {
        if (err.screen == null || p.page_path !== err.screen) return false
        const enteredMs = new Date(p.entered_at).getTime()
        const exitedMs = p.exited_at ? new Date(p.exited_at).getTime() : Infinity
        return errMs >= enteredMs && errMs < exitedMs
      })
      // Fall back to the currently-open page (still-better-than-nothing) if
      // the screen didn't match anything exactly.
      // deno-lint-ignore no-explicit-any
      if (!match) match = (pages as any[]).find((p) => p.exited_at == null)
      if (!match) continue
      deltas.set(match.id, (deltas.get(match.id) ?? 0) + 1)
    }

    for (const [pageId, delta] of deltas) {
      // deno-lint-ignore no-explicit-any
      const page = (pages as any[]).find((p) => p.id === pageId)
      await supabase.from('session_pages')
        .update({ error_count: (page?.error_count ?? 0) + delta })
        .eq('id', pageId)
    }
  }
}
