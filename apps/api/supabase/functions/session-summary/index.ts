/**
 * On-demand AI narrative summary for one session — the "Generate AI Summary"
 * button on the dashboard's session detail page. Same call shape as the
 * existing analyze/generate-insights functions (service-role client, no
 * stricter auth than the rest of this codebase's AI endpoints).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAiConfig } from '../_shared/ai.ts'
import { runSummaryForSession } from '../_shared/session-summary-engine.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const aiConfig = getAiConfig()
  if (!aiConfig) return respond({ error: 'No AI API key configured. Set OPENROUTER_API_KEY in Supabase secrets.' }, 500)

  const body = await req.json().catch(() => ({}))
  const sessionId = body.session_id as string | undefined
  if (!sessionId) return respond({ error: 'session_id is required' }, 400)

  const result = await runSummaryForSession(supabase, sessionId)
  if (!result.ok) return respond({ ok: false, error: result.reason }, 400)

  return respond({
    ok: true,
    narrative: result.narrative,
    confidence: result.confidence,
    frictionScore: result.frictionScore,
    satisfactionScore: result.satisfactionScore,
    dropOffProbability: result.dropOffProbability,
    conversionProbability: result.conversionProbability,
    engagementScore: result.engagementScore,
    complexityScore: result.complexityScore,
  })
})

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
