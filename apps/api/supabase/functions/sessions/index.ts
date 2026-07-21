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

  // action: 'start' | 'end'
  const { action, session_id, user_id, device_id, ended_at, duration } = body as Record<string, string>

  if (action === 'start') {
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        project_id: project.id,
        user_id: user_id ?? null,
        device_id: device_id ?? null,
        status: 'active',
      })
      .select('id')
      .single()

    if (error) return respond({ error: error.message }, 500)
    return respond({ ok: true, session_id: data.id })
  }

  if (action === 'end' && session_id) {
    const { error } = await supabase
      .from('sessions')
      .update({
        status: duration ? 'completed' : 'abandoned',
        ended_at: ended_at ?? new Date().toISOString(),
        duration: duration ? Number(duration) : null,
      })
      .eq('id', session_id)
      .eq('project_id', project.id)

    if (error) return respond({ error: error.message }, 500)
    return respond({ ok: true })
  }

  return respond({ error: 'Invalid action. Use "start" or "end".' }, 400)
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
