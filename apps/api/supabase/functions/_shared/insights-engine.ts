import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { askModel, AI_TOKEN_BUDGETS } from './ai.ts'
import { parseInsightList, normalizeInsightRow, fallbackInsightsFromTelemetry } from './insights-parse.ts'

export type InsightsResult =
  | { ok: true; count: number }
  | { ok: false; reason: string }

/**
 * Gathers a project's recent telemetry, asks the AI model for insights, and writes
 * them into ai_insights — scoped to exactly one project. Shared by the
 * manual (button-triggered) generate-insights handler and the event-driven
 * generate-insights-cron sweep, so there is one source of truth for the
 * summarization + prompt + parsing logic.
 */
export async function runInsightsForProject(
  supabase: SupabaseClient,
  projectId: string,
  opts: { since?: string } = {},
): Promise<InsightsResult> {
  const since = opts.since ?? '1970-01-01T00:00:00Z'

  const [
    { data: events },
    { data: errors },
    { data: perf },
    { data: incidents },
    { count: userCount },
    { data: sessions },
  ] = await Promise.all([
    supabase.from('events').select('event_name, event_category, screen_name, timestamp')
      .eq('project_id', projectId).gt('timestamp', since)
      .order('timestamp', { ascending: false }).limit(200),
    supabase.from('errors').select('error_type, message, severity, status, screen, created_at')
      .eq('project_id', projectId).gt('created_at', since)
      .order('created_at', { ascending: false }).limit(100),
    supabase.from('performance_metrics').select('metric_type, value, created_at')
      .eq('project_id', projectId).gt('created_at', since)
      .order('created_at', { ascending: false }).limit(100),
    supabase.from('incidents').select('title, severity, status, ai_summary, created_at')
      .eq('project_id', projectId).neq('status', 'resolved').limit(10),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
    supabase.from('sessions').select('outcome, platform, device_type, status, rage_click_count, dead_click_count, form_abandon_count')
      .eq('project_id', projectId).gt('started_at', since).limit(200),
  ])

  if (!events?.length && !errors?.length && !perf?.length) {
    return { ok: false, reason: 'Not enough new data yet to generate insights.' }
  }

  const summary = {
    users: { total: userCount ?? 0 },
    sessions: {
      total: sessions?.length ?? 0,
      abandoned: sessions?.filter((s) => s.status === 'abandoned').length ?? 0,
      outcomes: aggregateBy((sessions ?? []).filter((s) => s.outcome), 'outcome'),
      platforms: aggregateBy((sessions ?? []).filter((s) => s.platform), 'platform'),
      devices: aggregateBy((sessions ?? []).filter((s) => s.device_type), 'device_type'),
    },
    behaviorFriction: {
      totalRageClicks: (sessions ?? []).reduce((a, s) => a + (s.rage_click_count ?? 0), 0),
      totalDeadClicks: (sessions ?? []).reduce((a, s) => a + (s.dead_click_count ?? 0), 0),
      totalFormAbandons: (sessions ?? []).reduce((a, s) => a + (s.form_abandon_count ?? 0), 0),
    },
    events: {
      total: events?.length ?? 0,
      topNames: aggregateBy(events ?? [], 'event_name').slice(0, 8),
      topScreens: aggregateBy(events ?? [], 'screen_name').slice(0, 5),
      topCategories: aggregateBy(events ?? [], 'event_category').slice(0, 5),
    },
    errors: {
      total: errors?.length ?? 0,
      open: errors?.filter((e) => e.status === 'open').length ?? 0,
      resolved: errors?.filter((e) => e.status === 'resolved').length ?? 0,
      fatal: errors?.filter((e) => e.severity === 'fatal').length ?? 0,
      types: aggregateBy(errors ?? [], 'error_type').slice(0, 6),
      screens: aggregateBy(errors ?? [], 'screen').slice(0, 5),
    },
    performance: groupMetrics(perf ?? []),
    openIncidents: (incidents ?? []).map((i) => ({
      title: i.title,
      severity: i.severity,
      status: i.status,
    })),
  }

  const text = await askModel({
    system: 'You are an AI analyst for PAAQ. Return ONLY a JSON array — no markdown fences, no prose.',
    prompt: `Analyze this app data and return 3-5 actionable insights as a JSON array only.

App data:
${JSON.stringify(summary)}

[{"category":"error|warning|performance|growth|security|success","title":"max 60 chars","description":"1-2 sentences with numbers","confidence":0.85,"recommendation":"one concrete action"}]

Use real names and counts from the data. Skip sections with no signal.`,
    maxTokens: AI_TOKEN_BUDGETS.analysis,
    nvidiaTimeoutMs: 55_000,
  })

  let insights = parseInsightList(text)
  if (insights.length === 0) {
    insights = fallbackInsightsFromTelemetry(projectId, {
      errors: summary.errors,
      sessions: summary.sessions,
      behaviorFriction: summary.behaviorFriction,
    })
  }

  if (insights.length === 0) {
    return { ok: false, reason: 'Failed to parse AI response and no telemetry patterns were available for fallback insights.' }
  }

  const rows = insights
    .map((i) => normalizeInsightRow(i, projectId))
    .filter((row): row is Record<string, unknown> => row !== null)
  const { error: insertError } = await supabase.from('ai_insights').insert(rows)
  if (insertError) return { ok: false, reason: insertError.message }

  return { ok: true, count: rows.length }
}

function aggregateBy(arr: Record<string, unknown>[], key: string) {
  const counts: Record<string, number> = {}
  for (const item of arr) {
    const val = String(item[key] ?? 'unknown')
    counts[val] = (counts[val] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, count }))
}

function groupMetrics(perf: Record<string, unknown>[]) {
  const groups: Record<string, number[]> = {}
  for (const m of perf) {
    const key = String(m.metric_type ?? 'unknown')
    if (!groups[key]) groups[key] = []
    groups[key].push(Number(m.value))
  }
  return Object.fromEntries(
    Object.entries(groups).map(([key, values]) => [
      key,
      {
        avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      },
    ]),
  )
}
