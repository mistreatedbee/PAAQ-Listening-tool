import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runInsightsForProject } from '../_shared/insights-engine.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const body = await req.json().catch(() => ({})) as { project_id?: string }
  const projectId = body.project_id
  if (!projectId) return respond({ error: 'project_id is required' }, 400)

  // Prune this project's own stale insights only — never another tenant's.
  await supabase.from('ai_insights')
    .delete()
    .eq('project_id', projectId)
    .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

  let result
  try {
    result = await runInsightsForProject(supabase, projectId)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return respond({ error: `Anthropic API error: ${msg}` }, 500)
  }

  if (!result.ok) return respond({ ok: false, reason: result.reason })
  return respond({ ok: true, count: result.count })
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
