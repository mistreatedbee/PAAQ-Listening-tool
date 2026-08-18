import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAiConfig, askModel } from '../_shared/ai.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const aiConfig = getAiConfig()
  if (!aiConfig) return respond({ error: 'No AI API key configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in Supabase secrets.' }, 500)

  // project_id is optional — if omitted we use the first active project for this token
  const body = await req.json().catch(() => ({}))
  let projectId: string | null = body.project_id ?? null

  // If no project_id supplied, resolve via SDK token → tenant → first project
  if (!projectId) {
    const sdkToken = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
    if (sdkToken && (sdkToken.startsWith('sdk_live_') || sdkToken.startsWith('sdk_test_'))) {
      const { data: tokenRow } = await supabase
        .from('access_tokens')
        .select('tenant_id')
        .eq('token', sdkToken)
        .single()
      if (tokenRow) {
        const { data: proj } = await supabase
          .from('tenant_projects')
          .select('id')
          .eq('tenant_id', tokenRow.tenant_id)
          .eq('status', 'active')
          .limit(1)
          .single()
        projectId = proj?.id ?? null
      }
    }
  }

  // ── 1. Fetch data (filtered by project when we have an id) ────────────
  const filter = projectId
    ? (q: ReturnType<typeof supabase.from>) => q.eq('project_id', projectId!)
    : (q: ReturnType<typeof supabase.from>) => q

  const [
    { data: events },
    { data: errors },
    { data: perf },
    { data: sessions },
    { count: userCount },
    { data: sessionPages },
    { data: formFields },
  ] = await Promise.all([
    filter(supabase.from('events').select('event_name, event_category, screen_name, session_id, timestamp').order('timestamp', { ascending: false }).limit(500)),
    filter(supabase.from('errors').select('error_type, message, severity, status, screen, created_at').order('created_at', { ascending: false }).limit(200)),
    filter(supabase.from('performance_metrics').select('metric_type, value, created_at').order('created_at', { ascending: false }).limit(200)),
    filter(supabase.from('sessions').select('id, status, outcome, duration, started_at, platform, device_type, os_name, browser_name, rage_click_count, dead_click_count, form_abandon_count, page_count, interaction_count, active_seconds, idle_seconds').order('started_at', { ascending: false }).limit(200)),
    filter(supabase.from('users').select('*', { count: 'exact', head: true })),
    filter(supabase.from('session_pages').select('page_path, duration_ms, scroll_depth_pct, interaction_count, error_count').order('created_at', { ascending: false }).limit(500)),
    filter(supabase.from('form_field_stats').select('form_name, field_name, had_error, completed, backspace_count, time_spent_ms').order('created_at', { ascending: false }).limit(300)),
  ])

  // ── 2. Compute feature health ─────────────────────────────────────────
  const featureMap: Record<string, { events: number; errors: number; completions: number; starts: number }> = {}

  for (const e of events ?? []) {
    const feature = e.screen_name ?? e.event_category ?? 'Unknown'
    if (!featureMap[feature]) featureMap[feature] = { events: 0, errors: 0, completions: 0, starts: 0 }
    featureMap[feature].events++
    const name = (e.event_name ?? '').toLowerCase()
    if (/submit|complete|confirm|success|finish|done/.test(name)) featureMap[feature].completions++
    if (/start|begin|open|launch|init/.test(name)) featureMap[feature].starts++
  }

  for (const e of errors ?? []) {
    const feature = e.screen ?? 'Unknown'
    if (!featureMap[feature]) featureMap[feature] = { events: 0, errors: 0, completions: 0, starts: 0 }
    featureMap[feature].errors++
  }

  const maxEvents = Math.max(1, ...Object.values(featureMap).map((f) => f.events))

  const featureHealthRows = Object.entries(featureMap)
    .filter(([, f]) => f.events > 0)
    .map(([feature_name, f]) => {
      const usage_score      = f.events / maxEvents
      const error_rate       = f.errors / Math.max(f.events, 1)
      const error_score      = Math.max(0, 1 - error_rate * 3)
      const completion_rate  = f.starts > 0 ? Math.min(1, f.completions / f.starts) : 0.5
      const health_score     = usage_score * 0.25 + error_score * 0.5 + completion_rate * 0.25
      const trend            = error_rate > 0.2 ? 'declining' : error_rate < 0.05 ? 'improving' : 'stable'
      return {
        ...(projectId ? { project_id: projectId } : {}),
        feature_name,
        health_score:     Math.round(health_score * 100) / 100,
        usage_score:      Math.round(usage_score * 100) / 100,
        error_score:      Math.round(error_score * 100) / 100,
        completion_rate:  Math.round(completion_rate * 100) / 100,
        event_count:      f.events,
        error_count:      f.errors,
        trend,
      }
    })
    .sort((a, b) => b.event_count - a.event_count)

  // ── 3. Reconstruct user journeys ──────────────────────────────────────
  const journeyMap: Record<string, { screens: string[]; sessionId: string; completed: boolean }> = {}

  const sortedEvents = [...(events ?? [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  for (const e of sortedEvents) {
    if (!e.session_id || !e.screen_name) continue
    if (!journeyMap[e.session_id]) journeyMap[e.session_id] = { screens: [], sessionId: e.session_id, completed: false }
    const last = journeyMap[e.session_id].screens.at(-1)
    if (last !== e.screen_name) journeyMap[e.session_id].screens.push(e.screen_name)
    if (/submit|complete|success|finish|done/.test((e.event_name ?? '').toLowerCase())) {
      journeyMap[e.session_id].completed = true
    }
  }

  const journeyRows = Object.values(journeyMap)
    .filter((j) => j.screens.length > 1)
    .slice(0, 50)
    .map((j) => {
      const steps       = j.screens.map((screen, i) => ({ step: i + 1, screen }))
      const drop_off    = j.completed ? null : j.screens.at(-1) ?? null
      const name        = j.screens.length >= 2 ? `${j.screens[0]} → ${j.screens.at(-1)}` : j.screens[0]
      return {
        ...(projectId ? { project_id: projectId } : {}),
        session_id:        j.sessionId,
        journey_name:      name,
        steps,
        completed:         j.completed,
        drop_off_step:     drop_off,
        drop_off_reason:   !j.completed ? 'Session ended without completion' : null,
      }
    })

  // ── 4. Detect anomalies ───────────────────────────────────────────────
  const now = Date.now()
  const recentErrors = (errors ?? []).filter((e) => now - new Date(e.created_at).getTime() < 3_600_000)
  const olderErrors  = (errors ?? []).filter((e) => { const age = now - new Date(e.created_at).getTime(); return age >= 3_600_000 && age < 7_200_000 })

  const anomalyRows: Record<string, unknown>[] = []

  if (recentErrors.length > olderErrors.length * 1.5 && recentErrors.length > 2) {
    anomalyRows.push({
      ...(projectId ? { project_id: projectId } : {}),
      type: 'error_spike',
      severity: 'critical',
      detected_pattern: `Error rate increased ${Math.round((recentErrors.length / Math.max(olderErrors.length, 1)) * 100)}% in the last hour`,
      confidence: 0.88,
      metadata: { recent: recentErrors.length, previous: olderErrors.length },
    })
  }

  const abandonedSessions = sessions?.filter((s) => s.status === 'abandoned').length ?? 0
  const totalSessions = sessions?.length ?? 0
  if (totalSessions > 5 && abandonedSessions / totalSessions > 0.4) {
    anomalyRows.push({
      ...(projectId ? { project_id: projectId } : {}),
      type: 'high_abandonment',
      severity: 'warning',
      detected_pattern: `${Math.round((abandonedSessions / totalSessions) * 100)}% of sessions are being abandoned`,
      confidence: 0.82,
      metadata: { abandoned: abandonedSessions, total: totalSessions },
    })
  }

  // ── 5. Ask Claude for AI insights ─────────────────────────────────────
  // Real session-level signals (outcomes, device/platform mix, friction,
  // page-by-page behavior, form abandonment) — without these the summary
  // was effectively just "event name counts + error counts," which for a
  // low-traffic project barely changes run to run and produces the same
  // generic 4-6 insights every time.
  const outcomeBreakdown = aggregateBy((sessions ?? []).filter((s) => s.outcome), 'outcome')
  const platformBreakdown = aggregateBy((sessions ?? []).filter((s) => s.platform), 'platform')
  const deviceBreakdown = aggregateBy((sessions ?? []).filter((s) => s.device_type), 'device_type')

  const totalRageClicks = (sessions ?? []).reduce((a, s) => a + (s.rage_click_count ?? 0), 0)
  const totalDeadClicks = (sessions ?? []).reduce((a, s) => a + (s.dead_click_count ?? 0), 0)
  const totalFormAbandons = (sessions ?? []).reduce((a, s) => a + (s.form_abandon_count ?? 0), 0)
  const avgActiveSeconds = averageOf((sessions ?? []).map((s) => s.active_seconds).filter((v): v is number => v != null))
  const avgIdleSeconds = averageOf((sessions ?? []).map((s) => s.idle_seconds).filter((v): v is number => v != null))

  const pageMap: Record<string, { visits: number; errors: number; interactions: number; scrollSum: number; scrollCount: number; durationSum: number; durationCount: number }> = {}
  for (const p of sessionPages ?? []) {
    const key = p.page_path ?? 'unknown'
    if (!pageMap[key]) pageMap[key] = { visits: 0, errors: 0, interactions: 0, scrollSum: 0, scrollCount: 0, durationSum: 0, durationCount: 0 }
    const row = pageMap[key]
    row.visits++
    row.errors += p.error_count ?? 0
    row.interactions += p.interaction_count ?? 0
    if (p.scroll_depth_pct != null) { row.scrollSum += p.scroll_depth_pct; row.scrollCount++ }
    if (p.duration_ms != null) { row.durationSum += p.duration_ms; row.durationCount++ }
  }
  const pagesSummary = Object.entries(pageMap)
    .map(([page, r]) => ({
      page,
      visits: r.visits,
      errors: r.errors,
      avgInteractions: Math.round((r.interactions / r.visits) * 10) / 10,
      avgScrollPct: r.scrollCount > 0 ? Math.round(r.scrollSum / r.scrollCount) : null,
      avgDurationMs: r.durationCount > 0 ? Math.round(r.durationSum / r.durationCount) : null,
    }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 15)

  const fieldMap: Record<string, { touches: number; errors: number; abandoned: number; backspaceSum: number }> = {}
  for (const f of formFields ?? []) {
    const key = `${f.form_name ?? 'form'}.${f.field_name}`
    if (!fieldMap[key]) fieldMap[key] = { touches: 0, errors: 0, abandoned: 0, backspaceSum: 0 }
    const row = fieldMap[key]
    row.touches++
    if (f.had_error) row.errors++
    if (!f.completed) row.abandoned++
    row.backspaceSum += f.backspace_count ?? 0
  }
  const problemFields = Object.entries(fieldMap)
    .map(([field, r]) => ({ field, touches: r.touches, errorRate: Math.round((r.errors / r.touches) * 100), abandonRate: Math.round((r.abandoned / r.touches) * 100), avgBackspaces: Math.round((r.backspaceSum / r.touches) * 10) / 10 }))
    .filter((f) => f.errorRate > 0 || f.abandonRate > 0)
    .sort((a, b) => (b.errorRate + b.abandonRate) - (a.errorRate + a.abandonRate))
    .slice(0, 10)

  const summary = {
    users:    userCount ?? 0,
    sessions: {
      total: totalSessions,
      abandoned: abandonedSessions,
      outcomes: outcomeBreakdown,
      platforms: platformBreakdown,
      devices: deviceBreakdown,
      avgActiveSeconds,
      avgIdleSeconds,
    },
    behaviorFriction: {
      totalRageClicks,
      totalDeadClicks,
      totalFormAbandons,
    },
    pages: pagesSummary,
    problemFormFields: problemFields,
    features: featureHealthRows.slice(0, 10).map((f) => ({
      name: f.feature_name, health: Math.round(f.health_score * 100), events: f.event_count, errors: f.error_count, trend: f.trend,
    })),
    errors: {
      total:   errors?.length ?? 0,
      open:    errors?.filter((e) => e.status === 'open').length ?? 0,
      fatal:   errors?.filter((e) => e.severity === 'fatal').length ?? 0,
      types:   aggregateBy(errors ?? [], 'error_type').slice(0, 5),
      screens: aggregateBy(errors ?? [], 'screen').slice(0, 5),
    },
    performance: groupMetrics(perf ?? []),
    anomalies: anomalyRows.map((a) => ({ type: a.type, pattern: a.detected_pattern })),
  }

  const rawText = await askModel({
    system: 'You are the AI analyst for PAAQ, a digital product intelligence platform. Analyze the provided data and return structured JSON only.',
    prompt: `You are the AI analyst for PAAQ, a digital product intelligence platform. Analyze this data and return structured JSON only — no markdown, no explanation.

Data:
${JSON.stringify(summary, null, 2)}

Return this exact structure:
{
  "insights": [
    {
      "category": "error|warning|performance|growth|success",
      "title": "Specific title (max 60 chars)",
      "description": "2-3 sentences with specific numbers from the data",
      "confidence": 0.85,
      "recommendation": "One concrete action to take now",
      "priority": "critical|high|medium|low",
      "impact_score": 0.8,
      "affected_users": 0,
      "evidence": { "key_metric": "value" },
      "recommended_action": "Same as recommendation"
    }
  ],
  "feature_summaries": [
    { "feature_name": "ScreenName", "summary": "2 sentence analysis", "key_issue": "main problem if any" }
  ]
}

Rules:
- Generate 4-6 insights, and make them span DIFFERENT dimensions of the data
  — don't generate multiple insights about the same error or the same
  screen. Deliberately look across sessions.outcomes/platforms/devices,
  behaviorFriction (rage/dead clicks, form abandons), pages (which specific
  page paths have the most visits/errors/lowest scroll depth/longest
  dwell), problemFormFields (which specific field has the highest error or
  abandon rate), features, errors, and anomalies — pull from as many of
  these sections as have real data, not just "errors."
- Reference actual numbers AND actual names (real page paths, real field
  names, real platforms/devices) from the data — never generic filler like
  "the checkout flow" if the data doesn't name a checkout flow.
- If a section of the data is empty or has too little signal, skip it —
  do not invent an insight to fill a quota.
- priority "critical" = needs immediate attention
- impact_score 0.0-1.0 based on how many users affected
- affected_users = estimate based on session/user counts in data`,
    maxTokens: 3000,
  })

  const cleanText = rawText.replace(/```json?\n?/g, '').replace(/```/g, '').trim()

  let aiResult: { insights?: Record<string, unknown>[]; feature_summaries?: Record<string, unknown>[] } = {}
  if (cleanText) { try { aiResult = JSON.parse(cleanText) } catch { /* continue */ } }

  // Merge AI summaries into feature health rows
  const featureSummaryMap: Record<string, string> = {}
  for (const fs of aiResult.feature_summaries ?? []) {
    featureSummaryMap[fs.feature_name as string] = fs.summary as string
  }
  const featureRowsWithSummaries = featureHealthRows.map((f) => ({
    ...f,
    ai_summary: featureSummaryMap[f.feature_name] ?? null,
  }))

  // Add project_id to each AI insight row
  const insightRows = (aiResult.insights ?? []).map((ins) => ({
    ...ins,
    ...(projectId ? { project_id: projectId } : {}),
  }))

  // ── 6. Write to DB (clear old data for this project first) ────────────
  const projectFilter = projectId ? { project_id: projectId } : null

  if (projectFilter) {
    await Promise.all([
      supabase.from('feature_health').delete().eq('project_id', projectId!),
      supabase.from('user_journeys').delete().eq('project_id', projectId!),
      supabase.from('anomaly_events').delete().eq('project_id', projectId!),
      supabase.from('ai_insights').delete().eq('project_id', projectId!),
    ])
  } else {
    await Promise.all([
      supabase.from('feature_health').delete().gte('created_at', '1970-01-01T00:00:00Z'),
      supabase.from('user_journeys').delete().gte('created_at', '1970-01-01T00:00:00Z'),
      supabase.from('anomaly_events').delete().gte('created_at', '1970-01-01T00:00:00Z'),
      supabase.from('ai_insights').delete().gte('created_at', '1970-01-01T00:00:00Z'),
    ])
  }

  await Promise.all([
    featureRowsWithSummaries.length > 0 ? supabase.from('feature_health').insert(featureRowsWithSummaries) : Promise.resolve(),
    journeyRows.length > 0 ? supabase.from('user_journeys').insert(journeyRows) : Promise.resolve(),
    anomalyRows.length > 0 ? supabase.from('anomaly_events').insert(anomalyRows) : Promise.resolve(),
    insightRows.length > 0 ? supabase.from('ai_insights').insert(insightRows) : Promise.resolve(),
  ])

  // Auto-build product memory from the AI insights just generated so the knowledge
  // base grows autonomously after every analysis run — no manual upload required.
  if (projectId && insightRows.length > 0) {
    const summaryContent = insightRows.map((ins) =>
      `[${ins.category ?? 'insight'}] ${ins.title}: ${ins.description ?? ''}`
    ).join('\n')

    const knowledgeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/knowledge-build`
    fetch(knowledgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ projectId, content: summaryContent, title: 'AI Analysis — auto-generated', method: 'auto' }),
    }).catch(() => { /* non-fatal */ })
  }

  return respond({
    ok: true,
    features: featureRowsWithSummaries.length,
    journeys: journeyRows.length,
    anomalies: anomalyRows.length,
    insights: insightRows.length,
  })
})

function averageOf(nums: number[]): number | null {
  if (nums.length === 0) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

function aggregateBy(arr: Record<string, unknown>[], key: string) {
  const counts: Record<string, number> = {}
  for (const item of arr) {
    const val = String(item[key] ?? 'unknown')
    counts[val] = (counts[val] ?? 0) + 1
  }
  return Object.entries(counts).sort(([, a], [, b]) => b - a).map(([name, count]) => ({ name, count }))
}

function groupMetrics(perf: Record<string, unknown>[]) {
  const groups: Record<string, number[]> = {}
  for (const m of perf) {
    const key = String(m.metric_type ?? 'unknown')
    if (!groups[key]) groups[key] = []
    groups[key].push(Number(m.value))
  }
  return Object.fromEntries(Object.entries(groups).map(([key, vals]) => [
    key,
    { avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), count: vals.length },
  ]))
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
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
