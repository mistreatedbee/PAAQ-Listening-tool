import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  // Fetch recent platform data in parallel
  const [
    { data: events },
    { data: errors },
    { data: perf },
    { data: incidents },
    { count: userCount },
    { count: sessionCount },
  ] = await Promise.all([
    supabase.from('events').select('event_name, event_category, screen_name, timestamp').order('timestamp', { ascending: false }).limit(200),
    supabase.from('errors').select('error_type, message, severity, status, screen, created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('performance_metrics').select('metric_type, value, created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('incidents').select('title, severity, status, ai_summary, created_at').neq('status', 'resolved').limit(10),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('sessions').select('*', { count: 'exact', head: true }),
  ])

  if (!events?.length && !errors?.length && !perf?.length) {
    return respond({ ok: false, reason: 'Not enough data yet to generate insights. Send some events first.' })
  }

  // Build structured summary for Claude — send counts/aggregates, not raw rows
  const summary = {
    users: { total: userCount ?? 0 },
    sessions: { total: sessionCount ?? 0 },
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
      byType: aggregateBy(errors ?? [], 'error_type').slice(0, 6),
      byScreen: aggregateBy(errors ?? [], 'screen').slice(0, 5),
    },
    performance: groupMetrics(perf ?? []),
    openIncidents: (incidents ?? []).map((i) => ({
      title: i.title,
      severity: i.severity,
      status: i.status,
    })),
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return respond({ error: 'ANTHROPIC_API_KEY secret not set in Supabase' }, 500)

  const anthropic = new Anthropic({ apiKey })

  let message
  try {
    message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are an AI analyst for PAAQ, a mobile app monitoring platform. Analyze this real-time app data and generate 4-6 concise, specific, actionable insights. Return ONLY valid JSON — no markdown fences, no explanation outside the JSON.

App data:
${JSON.stringify(summary, null, 2)}

Return a JSON array:
[
  {
    "category": "error|warning|performance|growth|security|success",
    "title": "Short specific title (max 60 chars)",
    "description": "2-3 sentences of specific analysis. Reference actual numbers.",
    "confidence": 0.85,
    "recommendation": "One clear, concrete action to take right now"
  }
]

Rules:
- Reference actual numbers from the data (e.g. "3 of 5 errors are on PaymentScreen")
- error = critical issues needing immediate attention
- warning = trends to watch before they become problems
- performance = speed or resource findings
- growth = positive engagement patterns
- success = things working well, worth doubling down on
- confidence is 0.0–1.0 based on how much data you have
- Never say "consider monitoring" — be specific about WHAT and WHY`,
        },
      ],
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return respond({ error: `Anthropic API error: ${msg}` }, 500)
  }

  const content = message.content[0]
  if (content.type !== 'text') return respond({ error: 'No text response from AI' }, 500)

  // Strip accidental markdown fences
  const text = content.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()

  let insights: Record<string, unknown>[]
  try {
    insights = JSON.parse(text)
  } catch {
    return respond({ error: 'Failed to parse AI response', raw: text }, 500)
  }

  // Replace all existing insights with the fresh batch
  await supabase.from('ai_insights').delete().gte('created_at', '1970-01-01T00:00:00Z')
  const { error: insertError } = await supabase.from('ai_insights').insert(insights)
  if (insertError) return respond({ error: insertError.message }, 500)

  return respond({ ok: true, count: insights.length })
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
