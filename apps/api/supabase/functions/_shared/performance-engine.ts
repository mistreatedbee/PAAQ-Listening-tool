import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type SyncPerformanceResult = {
  inserted: number
  sources: Record<string, number>
}

const MAX_PAGE_MS = 120_000 // ignore open-tab durations that skew averages

function hourKey(ts: string): string {
  const d = new Date(ts)
  d.setMinutes(0, 0, 0)
  return d.toISOString()
}

/** Derive performance_metrics rows from session_pages, events and errors. */
export async function syncPerformanceMetrics(
  supabase: SupabaseClient,
  projectId: string,
): Promise<SyncPerformanceResult> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const sources: Record<string, number> = {}

  const [{ data: pages }, { data: events }, { data: errors }] = await Promise.all([
    supabase
      .from('session_pages')
      .select('duration_ms, created_at')
      .eq('project_id', projectId)
      .gte('created_at', since)
      .not('duration_ms', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1000),
    supabase
      .from('events')
      .select('created_at')
      .eq('project_id', projectId)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(2000),
    supabase
      .from('errors')
      .select('created_at')
      .eq('project_id', projectId)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(500),
  ])

  sources.session_pages = pages?.length ?? 0
  sources.events = events?.length ?? 0
  sources.errors = errors?.length ?? 0

  const rows: Record<string, unknown>[] = []

  // Page load / response time buckets
  const pageBuckets = new Map<string, number[]>()
  for (const p of pages ?? []) {
    const ms = Number(p.duration_ms)
    if (!Number.isFinite(ms) || ms <= 0 || ms > MAX_PAGE_MS) continue
    const key = hourKey(p.created_at)
    const list = pageBuckets.get(key) ?? []
    list.push(ms)
    pageBuckets.set(key, list)
  }
  for (const [bucket, vals] of pageBuckets) {
    const avg = vals.reduce((a, v) => a + v, 0) / vals.length
    rows.push({
      project_id: projectId,
      metric_type: 'response_time',
      value: Math.round(avg),
      source: 'derived',
      metadata: { sampleCount: vals.length, bucket },
      created_at: bucket,
    })
  }

  // Individual page samples for chart series when hourly buckets are sparse
  const recentPages = (pages ?? [])
    .map((p) => ({ ms: Number(p.duration_ms), at: p.created_at }))
    .filter((p) => Number.isFinite(p.ms) && p.ms > 0 && p.ms <= MAX_PAGE_MS)
    .slice(-8)
  for (const p of recentPages) {
    rows.push({
      project_id: projectId,
      metric_type: 'response_time',
      value: Math.round(p.ms),
      source: 'derived',
      metadata: { sample: 'page_load' },
      created_at: p.at,
    })
  }

  // Error rate per hour
  const eventBuckets = new Map<string, number>()
  for (const e of events ?? []) {
    const key = hourKey(e.created_at)
    eventBuckets.set(key, (eventBuckets.get(key) ?? 0) + 1)
  }
  const errorBuckets = new Map<string, number>()
  for (const err of errors ?? []) {
    const key = hourKey(err.created_at)
    errorBuckets.set(key, (errorBuckets.get(key) ?? 0) + 1)
  }
  const allHours = new Set([...eventBuckets.keys(), ...errorBuckets.keys()])
  for (const bucket of allHours) {
    const ev = eventBuckets.get(bucket) ?? 0
    const er = errorBuckets.get(bucket) ?? 0
    const total = ev + er
    if (total === 0) continue
    rows.push({
      project_id: projectId,
      metric_type: 'error_rate',
      value: Math.round((er / total) * 10000) / 100,
      source: 'derived',
      metadata: { errors: er, events: ev, bucket },
      created_at: bucket,
    })
  }

  if (rows.length === 0) {
    return { inserted: 0, sources }
  }

  // Replace derived rows so charts stay fresh without duplicating SDK-native metrics
  await supabase
    .from('performance_metrics')
    .delete()
    .eq('project_id', projectId)
    .eq('source', 'derived')

  const { error } = await supabase.from('performance_metrics').insert(rows)
  if (error) throw new Error(`Failed to insert performance metrics: ${error.message}`)

  return { inserted: rows.length, sources }
}
