/**
 * On-demand AI narrative summary for one session — the "Generate AI Summary"
 * button on the dashboard's session detail page. Same call shape as the
 * existing analyze/generate-insights functions (service-role client, no
 * stricter auth than the rest of this codebase's AI endpoints).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runSummaryForSession } from '../_shared/session-summary-engine.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return respond({ error: 'ANTHROPIC_API_KEY not set' }, 500)

  const body = await req.json().catch(() => ({}))
  const sessionId = body.session_id as string | undefined
  if (!sessionId) return respond({ error: 'session_id is required' }, 400)

  const result = await runSummaryForSession(supabase, sessionId)
  if (!result.ok) return respond({ ok: false, error: result.reason }, 400)

  return respond({ ok: true, narrative: result.narrative, confidence: result.confidence })
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
