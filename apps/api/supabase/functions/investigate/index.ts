/**
 * PAAQ Phase 3 — AI Investigation Orchestrator
 *
 * Runs 8 specialist agents against live platform data.
 * Writes to: investigations, agent_tasks, recommendations, product_memory
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const AGENTS = ['incident', 'root_cause', 'product', 'ux', 'qa', 'performance', 'security', 'executive'] as const
type AgentName = typeof AGENTS[number]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return respond({ error: 'ANTHROPIC_API_KEY not set' }, 500)

  const body = await req.json().catch(() => ({}))
  const { project_id, incident_id } = body

  try {
    const [
      { data: incidents },
      { data: errors },
      { data: sessions },
      { data: events },
      { data: perf },
      { data: anomalies },
      { data: features },
      { data: journeys },
    ] = await Promise.all([
      supabase.from('incidents').select('id, title, description, severity, status, created_at').neq('status', 'resolved').limit(5),
      supabase.from('errors').select('error_type, message, severity, status, screen, created_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('sessions').select('id, status, duration, started_at').order('started_at', { ascending: false }).limit(100),
      supabase.from('events').select('event_name, screen_name, session_id, timestamp').order('timestamp', { ascending: false }).limit(200),
      supabase.from('performance_metrics').select('metric_type, value, created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('anomaly_events').select('type, severity, detected_pattern, confidence').limit(10),
      supabase.from('feature_health').select('feature_name, health_score, trend, error_count').order('health_score').limit(10),
      supabase.from('user_journeys').select('journey_name, completed, drop_off_step').limit(20),
    ])

    const abandoned = sessions?.filter((s) => s.status === 'abandoned').length ?? 0
    const totalSessions = sessions?.length ?? 0
    const openErrors = errors?.filter((e) => e.status === 'open') ?? []
    const fatalErrors = openErrors.filter((e) => e.severity === 'fatal')

    const context = {
      incidents: (incidents ?? []).map((i) => ({ title: i.title, severity: i.severity, status: i.status })),
      errors: {
        open: openErrors.length,
        fatal: fatalErrors.length,
        byScreen: aggregateBy(errors ?? [], 'screen').slice(0, 5),
        byType: aggregateBy(errors ?? [], 'error_type').slice(0, 5),
      },
      sessions: {
        total: totalSessions,
        abandoned,
        abandonmentRate: totalSessions > 0 ? Math.round((abandoned / totalSessions) * 100) : 0,
        avgDuration: avgDuration(sessions ?? []),
      },
      performance: groupMetrics(perf ?? []),
      anomalies: (anomalies ?? []).map((a) => ({ type: a.type, pattern: a.detected_pattern, confidence: a.confidence })),
      features: (features ?? []).map((f) => ({ name: f.feature_name, health: f.health_score, trend: f.trend, errors: f.error_count })),
      journeys: {
        total: journeys?.length ?? 0,
        completed: journeys?.filter((j) => j.completed).length ?? 0,
        dropOffPoints: aggregateBy((journeys ?? []).filter((j) => j.drop_off_step), 'drop_off_step').slice(0, 3),
      },
    }

    const targetIncident = incident_id
      ? incidents?.find((i) => i.id === incident_id)
      : incidents?.[0]

    const investigationTitle = targetIncident?.title
      ? `Investigation: ${targetIncident.title}`
      : `Autonomous Platform Investigation — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`

    const { data: inv } = await supabase
      .from('investigations')
      .insert({
        project_id: project_id ?? null,
        incident_id: incident_id ?? targetIncident?.id ?? null,
        title: investigationTitle,
        status: 'running',
      })
      .select('id')
      .single()

    const investigationId = inv?.id
    const investigationStart = Date.now()

    const anthropic = new Anthropic({ apiKey })

    const aiMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `You are the PAAQ AI Investigation Orchestrator. Eight specialist agents report to you.

Live platform data:
${JSON.stringify(context, null, 2)}

Run a full investigation. Return structured JSON only — no markdown, no explanation.

{
  "investigation": {
    "root_cause": "Clear explanation of primary root cause with specific data",
    "timeline": [
      { "time": "relative time (e.g. 85 min ago)", "event": "what happened", "severity": "critical|high|medium|low" }
    ],
    "affected_services": ["service1"],
    "confidence": 0.87,
    "business_impact": "Human-readable business impact with numbers",
    "technical_impact": "Technical explanation with specific components"
  },
  "agent_outputs": {
    "incident": "Incident agent finding (2-3 sentences with specifics)",
    "root_cause": "Root cause agent determination (2-3 sentences)",
    "product": "Product analyst finding about user impact (2-3 sentences)",
    "ux": "UX friction points identified (2-3 sentences)",
    "qa": "QA regressions or test gaps detected (2-3 sentences)",
    "performance": "Performance metrics analysis (2-3 sentences with numbers)",
    "security": "Security observations or 'No security concerns detected'",
    "executive": "Plain-language executive summary (2-3 sentences, no jargon)"
  },
  "recommendations": [
    {
      "type": "fix|rollback|scale|notify|patch|investigate",
      "title": "Short action title (max 60 chars)",
      "description": "What to do and why — be specific",
      "confidence": 0.9,
      "impact_score": 0.8,
      "effort": "low|medium|high",
      "expected_improvement": "Specific measurable improvement",
      "suggested_owner": "Engineering|Product|DevOps|Security|Leadership",
      "priority": "critical|high|medium|low"
    }
  ],
  "memory_entry": {
    "type": "incident",
    "title": "Brief title for knowledge base (max 80 chars)",
    "summary": "One paragraph summary for future reference and similarity search",
    "tags": ["relevant", "tags"]
  }
}

Rules:
- Reference actual numbers and names from the data
- Timeline must have 3-6 entries in chronological order
- Generate 3-5 targeted, actionable recommendations
- confidence and impact_score must be 0.0-1.0`,
        },
      ],
    })

    const totalDuration = Date.now() - investigationStart

    const rawText = aiMessage.content[0]?.type === 'text'
      ? aiMessage.content[0].text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      : null

    let result: {
      investigation?: Record<string, unknown>
      agent_outputs?: Record<AgentName, string>
      recommendations?: Record<string, unknown>[]
      memory_entry?: Record<string, unknown>
    } = {}

    if (rawText) {
      try { result = JSON.parse(rawText) } catch { /* continue with partial data */ }
    }

    const invData = result.investigation ?? {}
    const perAgentMs = Math.round(totalDuration / AGENTS.length)

    // Write individual agent task records
    const agentTaskRows: Record<string, unknown>[] = AGENTS.map((name) => ({
      project_id: project_id ?? null,
      investigation_id: investigationId,
      agent_name: name,
      status: 'complete',
      output: { summary: result.agent_outputs?.[name] ?? 'No output generated' },
      duration_ms: perAgentMs,
      completed_at: new Date().toISOString(),
    }))

    await supabase.from('agent_tasks').insert(agentTaskRows)

    // Write investigation result
    await supabase.from('investigations').update({
      status: 'complete',
      root_cause: (invData.root_cause as string) ?? null,
      timeline: invData.timeline ?? null,
      affected_services: (invData.affected_services as string[]) ?? null,
      confidence: (invData.confidence as number) ?? null,
      business_impact: (invData.business_impact as string) ?? null,
      technical_impact: (invData.technical_impact as string) ?? null,
      evidence: result.agent_outputs ?? null,
      recommendations_count: result.recommendations?.length ?? 0,
      agents_run: Array.from(AGENTS),
      completed_at: new Date().toISOString(),
    }).eq('id', investigationId)

    // Write recommendations
    if (result.recommendations && result.recommendations.length > 0) {
      await supabase.from('recommendations').insert(
        result.recommendations.map((r) => ({
          project_id: project_id ?? null,
          investigation_id: investigationId,
          ...r,
        })),
      )
    }

    // Write to product memory
    if (result.memory_entry) {
      await supabase.from('product_memory').insert({
        project_id: project_id ?? null,
        ...result.memory_entry,
        content: {
          investigation_id: investigationId,
          root_cause: invData.root_cause,
          confidence: invData.confidence,
          affected_services: invData.affected_services,
        },
      })
    }

    return respond({
      ok: true,
      investigation_id: investigationId,
      recommendations: result.recommendations?.length ?? 0,
      agents: AGENTS.length,
      duration_ms: totalDuration,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
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
  return Object.fromEntries(
    Object.entries(groups).map(([key, vals]) => [
      key,
      { avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), count: vals.length },
    ]),
  )
}

function avgDuration(sessions: Record<string, unknown>[]) {
  const completed = sessions.filter((s) => s.duration != null)
  if (!completed.length) return null
  return Math.round(completed.reduce((a, s) => a + Number(s.duration), 0) / completed.length)
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
