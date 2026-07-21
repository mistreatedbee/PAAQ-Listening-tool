/**
 * PAAQ Phase 2 — AI Analysis Engine
 *
 * Processes all platform data and produces:
 * - Feature health scores
 * - User journey reconstructions
 * - Anomaly detection
 * - AI insights with evidence, priority, affected users
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return respond({ error: 'ANTHROPIC_API_KEY not set' }, 500)

  // Create a job record
  const { data: job } = await supabase
    .from('ai_analysis_jobs')
    .insert({ job_type: 'full_analysis', status: 'running', started_at: new Date().toISOString() })
    .select('id')
    .single()

  const jobId = job?.id

  try {
    // ── 1. Fetch all raw data in parallel ──────────────────────────────
    const [
      { data: events },
      { data: errors },
      { data: perf },
      { data: sessions },
      { count: userCount },
    ] = await Promise.all([
      supabase.from('events').select('event_name, event_category, screen_name, session_id, timestamp').order('timestamp', { ascending: false }).limit(500),
      supabase.from('errors').select('error_type, message, severity, status, screen, created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('performance_metrics').select('metric_type, value, created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('sessions').select('id, status, duration, started_at').order('started_at', { ascending: false }).limit(200),
      supabase.from('users').select('*', { count: 'exact', head: true }),
    ])

    // ── 2. Compute feature health locally ──────────────────────────────
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
        const usage_score = f.events / maxEvents
        const error_rate = f.errors / Math.max(f.events, 1)
        const error_score = Math.max(0, 1 - error_rate * 3)
        const completion_rate = f.starts > 0 ? Math.min(1, f.completions / f.starts) : 0.5
        const health_score = usage_score * 0.25 + error_score * 0.5 + completion_rate * 0.25
        const trend = error_rate > 0.2 ? 'declining' : error_rate < 0.05 ? 'improving' : 'stable'
        return {
          feature_name,
          health_score: Math.round(health_score * 100) / 100,
          usage_score: Math.round(usage_score * 100) / 100,
          error_score: Math.round(error_score * 100) / 100,
          completion_rate: Math.round(completion_rate * 100) / 100,
          event_count: f.events,
          error_count: f.errors,
          trend,
        }
      })
      .sort((a, b) => b.event_count - a.event_count)

    // ── 3. Reconstruct user journeys ───────────────────────────────────
    const journeyMap: Record<string, { screens: string[]; sessionId: string; completed: boolean }> = {}

    const sortedEvents = [...(events ?? [])].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )

    for (const e of sortedEvents) {
      if (!e.session_id || !e.screen_name) continue
      if (!journeyMap[e.session_id]) {
        journeyMap[e.session_id] = { screens: [], sessionId: e.session_id, completed: false }
      }
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
        const steps = j.screens.map((screen, i) => ({ step: i + 1, screen }))
        const drop_off_step = j.completed ? null : j.screens.at(-1) ?? null
        const session = sessions?.find((s) => s.id === j.sessionId)
        const name = j.screens.length >= 2
          ? `${j.screens[0]} → ${j.screens.at(-1)}`
          : j.screens[0]
        return {
          session_id: j.sessionId,
          journey_name: name,
          steps,
          completed: j.completed,
          drop_off_step,
          drop_off_reason: !j.completed ? 'Session ended without completion' : null,
        }
      })

    // ── 4. Detect anomalies ────────────────────────────────────────────
    const now = Date.now()
    const recentErrors = (errors ?? []).filter((e) => now - new Date(e.created_at).getTime() < 3_600_000)
    const olderErrors = (errors ?? []).filter((e) => {
      const age = now - new Date(e.created_at).getTime()
      return age >= 3_600_000 && age < 7_200_000
    })

    const anomalyRows: Record<string, unknown>[] = []

    if (recentErrors.length > olderErrors.length * 1.5 && recentErrors.length > 2) {
      anomalyRows.push({
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
        type: 'high_abandonment',
        severity: 'warning',
        detected_pattern: `${Math.round((abandonedSessions / totalSessions) * 100)}% of sessions are being abandoned`,
        confidence: 0.82,
        metadata: { abandoned: abandonedSessions, total: totalSessions },
      })
    }

    // ── 5. Send summary to Claude for AI insights ──────────────────────
    const summary = {
      users: userCount ?? 0,
      sessions: { total: totalSessions, abandoned: abandonedSessions },
      features: featureHealthRows.slice(0, 10).map((f) => ({
        name: f.feature_name,
        health: Math.round(f.health_score * 100),
        events: f.event_count,
        errors: f.error_count,
        trend: f.trend,
      })),
      errors: {
        total: errors?.length ?? 0,
        open: errors?.filter((e) => e.status === 'open').length ?? 0,
        fatal: errors?.filter((e) => e.severity === 'fatal').length ?? 0,
        types: aggregateBy(errors ?? [], 'error_type').slice(0, 5),
        screens: aggregateBy(errors ?? [], 'screen').slice(0, 5),
      },
      performance: groupMetrics(perf ?? []),
      anomalies: anomalyRows.map((a) => ({ type: a.type, pattern: a.detected_pattern })),
    }

    const anthropic = new Anthropic({ apiKey })
    const aiMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: `You are the AI analyst for PAAQ, a mobile app intelligence platform. Analyze this data and return structured JSON only — no markdown, no explanation.

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
- Generate 4-6 insights
- Reference actual numbers from the data
- priority "critical" = needs immediate attention
- impact_score 0.0-1.0 based on how many users affected
- affected_users = estimate based on session/user counts in data`,
        },
      ],
    })

    const rawText = aiMessage.content[0]?.type === 'text'
      ? aiMessage.content[0].text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      : null

    let aiResult: { insights?: Record<string, unknown>[]; feature_summaries?: Record<string, unknown>[] } = {}
    if (rawText) {
      try { aiResult = JSON.parse(rawText) } catch { /* continue without AI summaries */ }
    }

    // Merge AI summaries into feature health rows
    const featureSummaryMap: Record<string, string> = {}
    for (const fs of aiResult.feature_summaries ?? []) {
      featureSummaryMap[fs.feature_name as string] = fs.summary as string
    }
    const featureRowsWithSummaries = featureHealthRows.map((f) => ({
      ...f,
      ai_summary: featureSummaryMap[f.feature_name] ?? null,
    }))

    // ── 6. Write everything to DB ──────────────────────────────────────
    await Promise.all([
      // Replace feature health
      supabase.from('feature_health').delete().gte('created_at', '1970-01-01T00:00:00Z'),
      // Replace journeys
      supabase.from('user_journeys').delete().gte('created_at', '1970-01-01T00:00:00Z'),
      // Replace anomalies
      supabase.from('anomaly_events').delete().gte('created_at', '1970-01-01T00:00:00Z'),
      // Replace insights
      supabase.from('ai_insights').delete().gte('created_at', '1970-01-01T00:00:00Z'),
    ])

    await Promise.all([
      featureRowsWithSummaries.length > 0
        ? supabase.from('feature_health').insert(featureRowsWithSummaries)
        : Promise.resolve(),
      journeyRows.length > 0
        ? supabase.from('user_journeys').insert(journeyRows)
        : Promise.resolve(),
      anomalyRows.length > 0
        ? supabase.from('anomaly_events').insert(anomalyRows)
        : Promise.resolve(),
      aiResult.insights && aiResult.insights.length > 0
        ? supabase.from('ai_insights').insert(aiResult.insights)
        : Promise.resolve(),
    ])

    // Mark job complete
    await supabase.from('ai_analysis_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      result: {
        features: featureRowsWithSummaries.length,
        journeys: journeyRows.length,
        anomalies: anomalyRows.length,
        insights: aiResult.insights?.length ?? 0,
      },
    }).eq('id', jobId)

    return respond({
      ok: true,
      features: featureRowsWithSummaries.length,
      journeys: journeyRows.length,
      anomalies: anomalyRows.length,
      insights: aiResult.insights?.length ?? 0,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (jobId) {
      await supabase.from('ai_analysis_jobs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        result: { error: msg },
      }).eq('id', jobId)
    }
    return respond({ error: msg }, 500)
  }
})

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
