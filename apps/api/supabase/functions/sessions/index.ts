import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { closeSession, type SessionOutcome } from '../_shared/session-close.ts'

const VALID_OUTCOMES: SessionOutcome[] = ['completed', 'abandoned', 'timed_out', 'logged_out', 'crashed', 'force_closed']

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)

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

  // action: 'start' (deprecated) | 'end'
  const { action, session_id, ended_at, duration, outcome } = body as Record<string, string>

  if (action === 'start') {
    // sdk-init already creates the session row on every call — this action
    // predates that and, left live, causes double-session-row inserts. No SDK
    // calls it anymore (confirmed by grep across all SDK sources).
    return respond({ error: 'Deprecated — sessions are created automatically by sdk-init' }, 410)
  }

  if (action === 'end' && session_id) {
    const { data: session } = await supabase
      .from('sessions')
      .select('started_at')
      .eq('id', session_id)
      .eq('project_id', project.id)
      .maybeSingle()

    if (!session) return respond({ error: 'Session not found' }, 404)

    const resolvedOutcome: SessionOutcome = VALID_OUTCOMES.includes(outcome as SessionOutcome)
      ? (outcome as SessionOutcome)
      : (duration ? 'completed' : 'abandoned')

    const result = await closeSession(supabase, {
      sessionId: session_id,
      projectId: project.id,
      startedAt: session.started_at,
      outcome: resolvedOutcome,
      endedAt: ended_at ?? new Date().toISOString(),
    })

    if (!result.ok) return respond({ error: result.reason }, 500)
    return respond({ ok: true })
  }

  return respond({ error: 'Invalid action. Use "end".' }, 400)
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
