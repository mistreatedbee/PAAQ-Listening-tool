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

  const { external_user_id, email } = body as Record<string, string>
  if (!external_user_id) return respond({ error: 'external_user_id is required' }, 400)

  // Try to find an existing user with this external_user_id for this project
  const { data: existing } = await supabase
    .from('users')
    .select('id, external_user_id, email, created_at')
    .eq('project_id', project.id)
    .eq('external_user_id', external_user_id)
    .single()

  if (existing) {
    // Update email if it changed
    if (email && email !== existing.email) {
      await supabase.from('users').update({ email }).eq('id', existing.id)
    }
    return respond({ ok: true, user_id: existing.id, created: false })
  }

  // Create new user
  const { data: created, error } = await supabase
    .from('users')
    .insert({
      project_id: project.id,
      external_user_id,
      email: email ?? null,
    })
    .select('id')
    .single()

  if (error) return respond({ error: error.message }, 500)

  return respond({ ok: true, user_id: created.id, created: true })
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
