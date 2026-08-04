/**
 * Read-only cohort aggregation for the User Journey Explorer page.
 * Everything here is computed live from real sessions/session_pages/errors/
 * session_ai_summaries rows on every call — no caching, no AI, no writes.
 * Mirrors the analyze/insights-engine convention of fetching rows and
 * aggregating in JS rather than hand-writing SQL grouping.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const SESSION_CAP = 1500
const IN_CHUNK = 300
const PATH_STEP_CAP = 6 // truncate path signatures to keep grouping meaningful

type SessionRow = {
  id: string
  user_id: string | null
  started_at: string
  ended_at: string | null
  duration: number | null
  status: string
  outcome: string | null
  platform: string | null
  device_type: string | null
  os_name: string | null
  browser_name: string | null
  rage_click_count: number
  dead_click_count: number
  form_abandon_count: number
  page_count: number | null
  interaction_count: number | null
}

type PageRow = {
  session_id: string
  sequence: number
  page_path: string
  duration_ms: number | null
  error_count: number
  scroll_depth_pct: number | null
}

type Filters = {
  from?: string
  to?: string
  platform?: string
  deviceType?: string
  outcome?: string
  hasError?: boolean
  page?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const body = await req.json().catch(() => ({}))
  const projectId = body.project_id as string | undefined
  const filters: Filters = body.filters ?? {}
  if (!projectId) return respond({ error: 'project_id is required' }, 400)

  // ── 1. Fetch sessions with DB-side filters ────────────────────────────
  let q = supabase
    .from('sessions')
    .select('id, user_id, started_at, ended_at, duration, status, outcome, platform, device_type, os_name, browser_name, rage_click_count, dead_click_count, form_abandon_count, page_count, interaction_count')
    .eq('project_id', projectId)
    .order('started_at', { ascending: false })
    .limit(SESSION_CAP)

  if (filters.from) q = q.gte('started_at', filters.from)
  if (filters.to) q = q.lte('started_at', filters.to)
  if (filters.platform) q = q.eq('platform', filters.platform)
  if (filters.deviceType) q = q.eq('device_type', filters.deviceType)
  if (filters.outcome) q = q.eq('outcome', filters.outcome)

  const { data: sessionsData, error: sessionsErr } = await q
  if (sessionsErr) return respond({ ok: false, error: sessionsErr.message }, 500)
  let sessions = (sessionsData ?? []) as SessionRow[]

  if (sessions.length === 0) {
    return respond({ ok: true, ...emptyResult() })
  }

  const allIds = sessions.map((s) => s.id)

  // ── 2. Fetch session_pages + error counts + AI drop-off for those sessions ──
  const [pages, errorCountBySession, dropOffProbs] = await Promise.all([
    fetchInChunks<PageRow>('session_pages', 'session_id, sequence, page_path, duration_ms, error_count, scroll_depth_pct', 'session_id', allIds),
    fetchErrorCounts(allIds),
    fetchDropOffProbs(allIds),
  ])

  // ── 3. Post-fetch filters that need joined data ───────────────────────
  if (filters.hasError) {
    sessions = sessions.filter((s) => (errorCountBySession.get(s.id) ?? 0) > 0)
  }
  if (filters.page) {
    const needle = filters.page.toLowerCase()
    const sessionsWithPage = new Set(pages.filter((p) => p.page_path.toLowerCase().includes(needle)).map((p) => p.session_id))
    sessions = sessions.filter((s) => sessionsWithPage.has(s.id))
  }

  if (sessions.length === 0) {
    return respond({ ok: true, ...emptyResult() })
  }

  const scopedIds = new Set(sessions.map((s) => s.id))
  const scopedPages = pages.filter((p) => scopedIds.has(p.session_id))

  // Ordered per-session page sequences (needed by map + path ranking)
  const pagesBySession = new Map<string, PageRow[]>()
  for (const p of scopedPages) {
    const arr = pagesBySession.get(p.session_id) ?? []
    arr.push(p)
    pagesBySession.set(p.session_id, arr)
  }
  for (const arr of pagesBySession.values()) arr.sort((a, b) => a.sequence - b.sequence)

  // ── 4. Key metrics ─────────────────────────────────────────────────────
  const total = sessions.length
  const activeUsers = new Set(sessions.map((s) => s.user_id).filter(Boolean)).size
  const completed = sessions.filter((s) => s.outcome === 'completed')
  const abandonedOutcomes = new Set(['abandoned', 'timed_out', 'crashed', 'force_closed'])
  const abandoned = sessions.filter((s) => s.outcome && abandonedOutcomes.has(s.outcome))
  const withOutcome = sessions.filter((s) => !!s.outcome)

  const completionPct = withOutcome.length ? round1((completed.length / withOutcome.length) * 100) : null
  const abandonmentPct = withOutcome.length ? round1((abandoned.length / withOutcome.length) * 100) : null

  const durations = sessions.map((s) => s.duration).filter((d): d is number => d != null)
  const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null

  const completedDurations = completed.map((s) => s.duration).filter((d): d is number => d != null)
  const avgTimeToCompletion = completedDurations.length
    ? Math.round(completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length)
    : null

  const topDropOffPage = mostCommon(
    abandoned.map((s) => {
      const seq = pagesBySession.get(s.id)
      return seq && seq.length ? seq[seq.length - 1].page_path : null
    }).filter((p): p is string => !!p),
  )

  const pageErrorTotals = new Map<string, { visits: number; errors: number }>()
  for (const p of scopedPages) {
    const cur = pageErrorTotals.get(p.page_path) ?? { visits: 0, errors: 0 }
    cur.visits += 1
    cur.errors += p.error_count ?? 0
    pageErrorTotals.set(p.page_path, cur)
  }
  let highestFrictionPage: string | null = null
  let highestFrictionRate = -1
  for (const [path, stat] of pageErrorTotals) {
    if (stat.visits < 2) continue
    const rate = stat.errors / stat.visits
    if (rate > highestFrictionRate) { highestFrictionRate = rate; highestFrictionPage = path }
  }

  // ── 5. Journey Health Score ────────────────────────────────────────────
  const frictionRate = total ? sessions.filter((s) => s.rage_click_count > 0 || s.dead_click_count > 0 || s.form_abandon_count > 0).length / total : 0
  const errorRate = total ? sessions.filter((s) => (errorCountBySession.get(s.id) ?? 0) > 0).length / total : 0
  const avgDropOffProb = dropOffProbs.length ? dropOffProbs.reduce((a, b) => a + b, 0) / dropOffProbs.length : null

  const healthTerms: { value: number; weight: number }[] = [
    { value: (completionPct ?? 0) / 100, weight: 0.4 },
    { value: 1 - frictionRate, weight: 0.3 },
    { value: 1 - errorRate, weight: 0.2 },
  ]
  if (avgDropOffProb != null) healthTerms.push({ value: 1 - avgDropOffProb, weight: 0.1 })
  const weightSum = healthTerms.reduce((a, t) => a + t.weight, 0)
  const journeyHealthScore = Math.round(
    healthTerms.reduce((a, t) => a + t.value * (t.weight / weightSum), 0) * 100,
  )

  // ── 6. Visual journey map: page-to-page transition graph ─────────────
  const nodeTraffic = new Map<string, { sessions: number; dropOffs: number }>()
  const edgeCounts = new Map<string, number>() // "A→B" -> count
  for (const s of sessions) {
    const seq = pagesBySession.get(s.id)
    if (!seq || seq.length === 0) continue
    for (let i = 0; i < seq.length; i++) {
      const node = nodeTraffic.get(seq[i].page_path) ?? { sessions: 0, dropOffs: 0 }
      node.sessions += 1
      if (i === seq.length - 1 && s.outcome && abandonedOutcomes.has(s.outcome)) node.dropOffs += 1
      nodeTraffic.set(seq[i].page_path, node)
      if (i < seq.length - 1) {
        const key = `${seq[i].page_path}→${seq[i + 1].page_path}`
        edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1)
      }
    }
  }
  const topNodes = [...nodeTraffic.entries()]
    .sort((a, b) => b[1].sessions - a[1].sessions)
    .slice(0, 12)
    .map(([path, stat]) => ({
      path,
      sessions: stat.sessions,
      pctOfTotal: round1((stat.sessions / total) * 100),
      dropOffs: stat.dropOffs,
      dropOffPct: stat.sessions ? round1((stat.dropOffs / stat.sessions) * 100) : 0,
    }))
  const topNodePaths = new Set(topNodes.map((n) => n.path))
  const edges = [...edgeCounts.entries()]
    .map(([key, count]) => {
      const [from, to] = key.split('→')
      return { from, to, count }
    })
    .filter((e) => topNodePaths.has(e.from) && topNodePaths.has(e.to))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24)

  // ── 7. Path rankings ───────────────────────────────────────────────────
  type PathGroup = { signature: string; steps: string[]; sessionIds: string[] }
  const pathGroups = new Map<string, PathGroup>()
  for (const s of sessions) {
    const seq = pagesBySession.get(s.id)
    if (!seq || seq.length === 0) continue
    const steps = seq.slice(0, PATH_STEP_CAP).map((p) => p.page_path)
    const signature = steps.join(' → ')
    const g = pathGroups.get(signature) ?? { signature, steps, sessionIds: [] }
    g.sessionIds.push(s.id)
    pathGroups.set(signature, g)
  }
  const pathStats = [...pathGroups.values()]
    .filter((g) => g.sessionIds.length >= 2)
    .map((g) => {
      const groupSessions = g.sessionIds.map((id) => sessions.find((s) => s.id === id)!).filter(Boolean)
      const completedCount = groupSessions.filter((s) => s.outcome === 'completed').length
      const abandonedCount = groupSessions.filter((s) => s.outcome && abandonedOutcomes.has(s.outcome)).length
      const errorTotal = g.sessionIds.reduce((a, id) => a + (errorCountBySession.get(id) ?? 0), 0)
      return {
        signature: g.signature,
        steps: g.steps,
        sessionCount: g.sessionIds.length,
        completedCount,
        abandonedCount,
        completionRate: groupSessions.length ? round1((completedCount / groupSessions.length) * 100) : 0,
        errorDensity: round1(errorTotal / g.sessionIds.length),
      }
    })

  const commonPaths = [...pathStats].sort((a, b) => b.sessionCount - a.sessionCount).slice(0, 8)
  const abandonedPaths = [...pathStats].filter((p) => p.abandonedCount > 0).sort((a, b) => b.abandonedCount - a.abandonedCount).slice(0, 8)
  const successfulPaths = [...pathStats].filter((p) => p.completedCount > 0).sort((a, b) => b.completedCount - a.completedCount).slice(0, 8)
  const problematicPaths = [...pathStats].filter((p) => p.errorDensity > 0).sort((a, b) => b.errorDensity - a.errorDensity).slice(0, 8)

  // ── 8. Device intelligence rollup ──────────────────────────────────────
  const deviceIntel = {
    platform: rollupCounts(sessions, (s) => s.platform),
    deviceType: rollupCounts(sessions, (s) => s.device_type),
    osName: rollupCounts(sessions, (s) => s.os_name),
    browserName: rollupCounts(sessions, (s) => s.browser_name),
  }

  // ── 9. Error correlation (errors.screen, grouped, joined to known pages) ─
  const errorScreens = await fetchErrorScreenCounts(allIds.filter((id) => scopedIds.has(id)))
  const errorCorrelation = errorScreens.slice(0, 10)

  return respond({
    ok: true,
    scope: { totalSessionsConsidered: total, activeUsers },
    metrics: {
      totalSessions: total,
      activeUsers,
      completionPct,
      abandonmentPct,
      avgDurationSeconds: avgDuration,
      avgTimeToCompletionSeconds: avgTimeToCompletion,
      topDropOffPage,
      highestFrictionPage,
    },
    journeyHealthScore,
    journeyMap: { nodes: topNodes, edges },
    paths: { common: commonPaths, abandoned: abandonedPaths, successful: successfulPaths, problematic: problematicPaths },
    deviceIntel,
    errorCorrelation,
  })
})

function emptyResult() {
  return {
    scope: { totalSessionsConsidered: 0, activeUsers: 0 },
    metrics: {
      totalSessions: 0, activeUsers: 0, completionPct: null, abandonmentPct: null,
      avgDurationSeconds: null, avgTimeToCompletionSeconds: null, topDropOffPage: null, highestFrictionPage: null,
    },
    journeyHealthScore: null,
    journeyMap: { nodes: [], edges: [] },
    paths: { common: [], abandoned: [], successful: [], problematic: [] },
    deviceIntel: { platform: [], deviceType: [], osName: [], browserName: [] },
    errorCorrelation: [],
  }
}

async function fetchInChunks<T>(table: string, columns: string, inColumn: string, ids: string[]): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    const { data } = await supabase.from(table).select(columns).in(inColumn, chunk)
    if (data) out.push(...(data as T[]))
  }
  return out
}

async function fetchErrorCounts(sessionIds: string[]): Promise<Map<string, number>> {
  const rows = await fetchInChunks<{ session_id: string }>('errors', 'session_id', 'session_id', sessionIds)
  const map = new Map<string, number>()
  for (const r of rows) map.set(r.session_id, (map.get(r.session_id) ?? 0) + 1)
  return map
}

async function fetchErrorScreenCounts(sessionIds: string[]): Promise<{ screen: string; count: number }[]> {
  const rows = await fetchInChunks<{ screen: string | null }>('errors', 'screen', 'session_id', sessionIds)
  const map = new Map<string, number>()
  for (const r of rows) {
    if (!r.screen) continue
    map.set(r.screen, (map.get(r.screen) ?? 0) + 1)
  }
  return [...map.entries()].map(([screen, count]) => ({ screen, count })).sort((a, b) => b.count - a.count)
}

async function fetchDropOffProbs(sessionIds: string[]): Promise<number[]> {
  const rows = await fetchInChunks<{ drop_off_probability: number | null }>('session_ai_summaries', 'drop_off_probability', 'session_id', sessionIds)
  return rows.map((r) => r.drop_off_probability).filter((v): v is number => v != null)
}

function rollupCounts<T>(rows: T[], get: (r: T) => string | null): { value: string; count: number; pct: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const v = get(r)
    if (!v) continue
    map.set(v, (map.get(v) ?? 0) + 1)
  }
  const total = rows.length
  return [...map.entries()].map(([value, count]) => ({ value, count, pct: round1((count / total) * 100) })).sort((a, b) => b.count - a.count)
}

function mostCommon(values: string[]): string | null {
  if (values.length === 0) return null
  const map = new Map<string, number>()
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1)
  return [...map.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}
