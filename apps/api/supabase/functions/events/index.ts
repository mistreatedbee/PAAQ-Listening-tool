import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }

  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, 405)
  }

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

  // Accept single event or batch
  const eventsRaw = Array.isArray(body) ? body : [body]

  const rows = eventsRaw.map((e: Record<string, unknown>) => ({
    project_id: project.id,
    user_id: e.user_id ?? null,
    session_id: e.session_id ?? null,
    event_name: e.event_name ?? e.name,
    event_category: e.event_category ?? e.category ?? null,
    screen_name: e.screen_name ?? e.screen ?? null,
    properties: e.properties ?? {},
    timestamp: e.timestamp ?? new Date().toISOString(),
  }))

  const { error } = await supabase.from('events').insert(rows)
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
