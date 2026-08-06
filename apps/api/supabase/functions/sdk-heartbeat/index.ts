/**
 * PAAQ Intelligence Platform — SDK Heartbeat
 *
 * Called periodically (every few minutes) by a running SDK to keep its
 * `sdk_installations.last_seen` fresh between real `sdk-init` handshakes,
 * so the dashboard's Connection Status panel reflects a process that is
 * genuinely still alive — not a synthetic timer. Unlike sdk-init, this
 * does NOT create a new session or audit-log row on every call; it's a
 * pure last_seen upsert, safe to call as often as the SDK likes.
 *
 * Required headers (same credentials as sdk-init):
 *   Authorization:  Bearer sdk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   X-Project-ID:   proj_xxxxxxxx
 *   X-SDK-Version:  1.2.4
 *   X-Platform:     nodejs | python | ...
 *
 * Optional JSON body: { "deviceId": "..." }
 *
 * Returns: { ok: true } | { ok: false, error: "<message>" }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  try { return await _handle(req) } catch (e) {
    return respond({ ok: false, error: String(e) }, 500)
  }
})

async function _handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  if (req.method !== 'POST') return respond({ ok: false, error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('authorization') ?? ''
  const sdkToken   = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const projectKey = req.headers.get('x-project-id') ?? ''
  const sdkVersion = req.headers.get('x-sdk-version') ?? 'unknown'
  const platform   = (req.headers.get('x-platform') ?? 'other').toLowerCase()

  if (!sdkToken || !projectKey) {
    return respond({ ok: false, error: 'Missing Authorization or X-Project-ID header' }, 401)
  }

  const { data: tokenRow, error: tokenErr } = await sb
    .from('access_tokens')
    .select('tenant_id')
    .eq('token', sdkToken)
    .eq('token_type', 'sdk_token')
    .in('status', ['active', 'rotating'])
    .single()

  if (tokenErr || !tokenRow) {
    return respond({ ok: false, error: 'Invalid SDK token' }, 401)
  }

  const { data: project, error: projectErr } = await sb
    .from('tenant_projects')
    .select('id, status')
    .eq('project_id_key', projectKey)
    .eq('tenant_id', tokenRow.tenant_id)
    .single()

  if (projectErr || !project) {
    return respond({ ok: false, error: 'Project not found or does not belong to this token' }, 401)
  }

  if (project.status !== 'active') {
    return respond({ ok: false, error: `Project is ${project.status}` }, 403)
  }

  let body: { deviceId?: string } = {}
  try { body = await req.json() } catch { /* body is optional */ }

  await sb.from('sdk_installations').upsert(
    {
      tenant_id:   tokenRow.tenant_id,
      project_id:  project.id,
      sdk_version: sdkVersion,
      platform,
      device_id:   body.deviceId ?? 'unknown',
      last_seen:   new Date().toISOString(),
      status:      'active',
    },
    { onConflict: 'tenant_id,project_id,device_id,platform', ignoreDuplicates: false },
  )

  return respond({ ok: true })
}

function cors() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, x-project-id, x-sdk-version, x-platform, x-environment',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
}
