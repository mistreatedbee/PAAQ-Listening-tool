/**
 * PAAQ Phase 2 — AI Search / Natural Language Query
 *
 * Accepts a plain-language question from the admin,
 * pulls relevant data from the DB, and answers using Claude.
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

  const body = await req.json().catch(() => null)
  const question: string = body?.question ?? ''
  if (!question.trim()) return respond({ error: 'question is required' }, 400)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return respond({ error: 'ANTHROPIC_API_KEY not set' }, 500)

  // Fetch a broad platform snapshot to give Claude context
  const [
    { data: insights },
    { data: features },
    { data: errors },
    { data: incidents },
    { data: anomalies },
    { data: perf },
    { count: userCount },
    { count: sessionCount },
    { count: eventCount },
  ] = await Promise.all([
    supabase.from('ai_insights').select('category, title, description, priority, affected_users, recommendation').order('created_at', { ascending: false }).limit(10),
    supabase.from('feature_health').select('feature_name, health_score, trend, error_count, ai_summary').order('health_score', { ascending: true }).limit(10),
    supabase.from('errors').select('error_type, message, severity, status, screen, created_at').order('created_at', { ascending: false }).limit(20),
    supabase.from('incidents').select('title, severity, status, ai_summary').neq('status', 'resolved').limit(5),
    supabase.from('anomaly_events').select('type, severity, detected_pattern, confidence').order('created_at', { ascending: false }).limit(5),
    supabase.from('performance_metrics').select('metric_type, value').order('created_at', { ascending: false }).limit(20),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('sessions').select('*', { count: 'exact', head: true }),
    supabase.from('events').select('*', { count: 'exact', head: true }),
  ])

  const platformData = {
    summary: {
      users: userCount ?? 0,
      sessions: sessionCount ?? 0,
      events: eventCount ?? 0,
    },
    open_incidents: incidents ?? [],
    recent_errors: (errors ?? []).map((e) => ({
      type: e.error_type,
      message: e.message,
      severity: e.severity,
      status: e.status,
      screen: e.screen,
      time: e.created_at,
    })),
    feature_health: features ?? [],
    ai_insights: insights ?? [],
    anomalies: anomalies ?? [],
    performance: groupMetrics(perf ?? []),
  }

  const anthropic = new Anthropic({ apiKey })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `You are the PAAQ AI assistant — a real-time AI analyst embedded in an app monitoring dashboard. You have access to live platform data and answer questions concisely and specifically. You always reference actual numbers from the data. You are direct and useful, not generic. Use **bold** for key findings. Keep answers under 150 words unless the question specifically needs more detail.`,
    messages: [
      {
        role: 'user',
        content: `Platform data:
${JSON.stringify(platformData, null, 2)}

Question: ${question}`,
      },
    ],
  })

  const answer = message.content[0]?.type === 'text' ? message.content[0].text : 'Unable to generate response.'

  return respond({ ok: true, answer })
})

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
