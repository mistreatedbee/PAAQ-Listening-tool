import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) return respond({ error: 'Missing x-api-key header' }, 401)

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('api_key', apiKey)
    .single()

  if (!project) return respond({ error: 'Invalid API key' }, 401)

  const body = await req.json().catch(() => null)
  if (!body) return respond({ error: 'Invalid JSON' }, 400)

  const metricsRaw = Array.isArray(body) ? body : [body]

  const rows = metricsRaw.map((m: Record<string, unknown>) => ({
    project_id:  project.id,
    metric_type: m.metric_type ?? m.type,
    value:       Number(m.value),
    metadata:    m.metadata ?? {},
  }))

  const { error } = await supabase.from('performance_metrics').insert(rows)
  if (error) return respond({ error: error.message }, 500)

  return respond({ ok: true, inserted: rows.length })
})

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}
