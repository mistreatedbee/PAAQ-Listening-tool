/**
 * PAAQ Phase 2 — AI Search / Natural Language Query
 *
 * Accepts a plain-language question from the admin,
 * pulls relevant data from the DB filtered by project_id, and answers using
 * whichever configured AI key is active: Gemini or Anthropic.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { askModel, getAiConfig } from '../_shared/ai.ts'

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

  const aiConfig = getAiConfig()
  if (!aiConfig) return respond({ error: 'No AI API key configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in Supabase secrets.' }, 500)

  const project_id: string | null = body?.project_id ?? null

  // Helper: conditionally filter by project_id
  // deno-lint-ignore no-explicit-any
  const pf = (q: any) => project_id ? q.eq('project_id', project_id) : q

  // Fetch a platform snapshot scoped to this project
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
    pf(supabase.from('ai_insights').select('category, title, description, priority, affected_users, recommendation').order('created_at', { ascending: false })).limit(10),
    pf(supabase.from('feature_health').select('feature_name, health_score, trend, error_count, ai_summary').order('health_score', { ascending: true })).limit(10),
    pf(supabase.from('errors').select('error_type, message, severity, status, screen, created_at').order('created_at', { ascending: false })).limit(20),
    pf(supabase.from('incidents').select('title, severity, status, ai_summary').neq('status', 'resolved')).limit(5),
    pf(supabase.from('anomaly_events').select('type, severity, detected_pattern, confidence').order('created_at', { ascending: false })).limit(5),
    pf(supabase.from('performance_metrics').select('metric_type, value').order('created_at', { ascending: false })).limit(20),
    pf(supabase.from('users').select('*', { count: 'exact', head: true })),
    pf(supabase.from('sessions').select('*', { count: 'exact', head: true })),
    pf(supabase.from('events').select('*', { count: 'exact', head: true })),
  ])

  const hasData = (eventCount ?? 0) > 0 || (errors?.length ?? 0) > 0 || (insights?.length ?? 0) > 0

  const platformData = {
    project_id: project_id ?? 'all',
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

  const systemPrompt = hasData
    ? `You are the PAAQ AI assistant — a real-time AI analyst embedded in an app monitoring dashboard. You have access to live platform data scoped to this specific application and answer questions concisely and specifically. You always reference actual numbers and names from the data provided. You are direct and useful, not generic. Use **bold** for key findings. Keep answers under 150 words unless the question specifically needs more detail. Never invent metrics — only reference what is in the data.`
    : `You are the PAAQ AI assistant. No telemetry data has been received from this application yet. The SDK may not be sending events, or this is a new project. Explain this honestly and suggest next steps: verify SDK integration, check that events are being tracked, and run an AI analysis once data arrives. Keep your response concise.`

  const answer = await askModel({
    system: systemPrompt,
    prompt: hasData
      ? `Platform data:\n${JSON.stringify(platformData, null, 2)}\n\nQuestion: ${question}`
      : `Question: ${question}`,
    maxTokens: 1024,
  })

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
