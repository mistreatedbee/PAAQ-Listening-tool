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

  // ── Auth ─────────────────────────────────────────────────────────────────
  const sdkToken   = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  const projectKey = req.headers.get('x-project-id') ?? ''

  if (!sdkToken) {
    return respond({ error: 'Missing Authorization header' }, 401)
  }
  if (!sdkToken.startsWith('sdk_live_') && !sdkToken.startsWith('sdk_test_')) {
    return respond({ error: 'Invalid SDK token format' }, 401)
  }

  const { data: tokenRow } = await supabase
    .from('access_tokens')
    .select('tenant_id, status, rotation_expires_at')
    .eq('token', sdkToken)
    .eq('token_type', 'sdk_token')
    .in('status', ['active', 'rotating'])
    .single()

  if (!tokenRow) {
    return respond({ error: 'Invalid SDK token' }, 401)
  }

  if (tokenRow.status === 'rotating' && tokenRow.rotation_expires_at) {
    if (new Date() > new Date(tokenRow.rotation_expires_at)) {
      return respond({ error: 'SDK token has been rotated — please update to the new token' }, 401)
    }
  }

  const { data: project } = await supabase
    .from('tenant_projects')
    .select('id, status')
    .eq('project_id_key', projectKey)
    .eq('tenant_id', tokenRow.tenant_id)
    .single()

  if (!project) {
    return respond({ error: 'Project not found or does not belong to this token' }, 401)
  }

  if (project.status !== 'active') {
    return respond({ error: `Project is ${project.status}` }, 403)
  }
  // ─────────────────────────────────────────────────────────────────────────

  const body = await req.json().catch(() => null)
  if (!body) return respond({ error: 'Invalid JSON' }, 400)

  // Accept single event or batch
  const eventsRaw = Array.isArray(body) ? body : [body]

  const rows = eventsRaw.map((e: Record<string, unknown>) => ({
    project_id:     project.id,
    user_id:        e.user_id ?? null,
    session_id:     e.session_id ?? null,
    event_name:     e.event_name ?? e.name,
    event_category: e.event_category ?? e.category ?? null,
    screen_name:    e.screen_name ?? e.screen ?? null,
    properties:     e.properties ?? {},
    timestamp:      e.timestamp ?? new Date().toISOString(),
  }))

  const { error } = await supabase.from('events').insert(rows)
  if (error) return respond({ error: error.message }, 500)

  return respond({ ok: true, inserted: rows.length })
})

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-project-id, x-sdk-version, x-platform, x-environment',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}
