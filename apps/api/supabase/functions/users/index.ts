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

  // ── Auth (same scheme as events/sdk-init) ───────────────────────────────
  const sdkToken   = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  const projectKey = req.headers.get('x-project-id') ?? ''

  if (!sdkToken) return respond({ error: 'Missing Authorization header' }, 401)
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

  if (!tokenRow) return respond({ error: 'Invalid SDK token' }, 401)

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

  if (!project) return respond({ error: 'Project not found or does not belong to this token' }, 401)
  if (project.status !== 'active') return respond({ error: `Project is ${project.status}` }, 403)
  // ─────────────────────────────────────────────────────────────────────────

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
    if (email && email !== existing.email) {
      await supabase.from('users').update({ email }).eq('id', existing.id)
    }
    return respond({ ok: true, user_id: existing.id, created: false })
  }

  // Create new user — this FKs to the legacy `projects` table, which not every
  // tenant project has a mirror row in yet. Degrade to an honest error rather
  // than a 500 if that mirror row is missing.
  const { data: created, error } = await supabase
    .from('users')
    .insert({
      project_id: project.id,
      external_user_id,
      email: email ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23503') {
      return respond({ ok: false, error: 'Project is not yet provisioned for user identification' }, 409)
    }
    return respond({ ok: false, error: error.message }, 500)
  }

  return respond({ ok: true, user_id: created.id, created: true })
})

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-project-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}
