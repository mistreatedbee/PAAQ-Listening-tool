import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkAndRecordDbHeartbeat } from '../_shared/db-heartbeat.ts'
import { recordPageViews } from '../_shared/session-pages.ts'
import { recordBehaviorEvents } from '../_shared/behavior-events.ts'

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

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const asUuid = (v: unknown) => (typeof v === 'string' && UUID_RE.test(v) ? v : null)

  const rows = eventsRaw.map((e: Record<string, unknown>) => ({
    project_id:     project.id,
    user_id:        asUuid(e.user_id),
    session_id:     asUuid(e.session_id),
    event_name:     e.event_name ?? e.name,
    event_category: e.event_category ?? e.category ?? null,
    screen_name:    e.screen_name ?? e.screen ?? null,
    properties:     e.properties ?? {},
    timestamp:      e.timestamp ?? new Date().toISOString(),
  }))

  let insertedRows = rows
  let { error } = await supabase.from('events').insert(rows)
  if (error?.code === '23503') {
    // session_id/user_id don't resolve to real rows for this project yet — degrade
    // gracefully rather than dropping the whole batch.
    insertedRows = rows.map((r) => ({ ...r, session_id: null, user_id: null }))
    ;({ error } = await supabase.from('events').insert(insertedRows))
  }
  if (error) return respond({ error: error.message }, 500)

  // Maintain the real page-by-page breakdown from $page_view/$screen events in
  // this batch — best-effort, never blocks the SDK's response on failure.
  try {
    await recordPageViews(supabase, project.id, insertedRows)
  } catch (e) {
    console.error('events: recordPageViews failed', e)
  }

  try {
    await recordBehaviorEvents(supabase, project.id, insertedRows)
  } catch (e) {
    console.error('events: recordBehaviorEvents failed', e)
  }

  const now = new Date().toISOString()
  const platform = req.headers.get('x-platform') ?? 'react'
  const sdkVersion = req.headers.get('x-sdk-version') ?? '0'

  const FRONTEND_PLATFORMS = new Set(['react', 'nextjs', 'vue', 'angular', 'vanilla'])

  // Call upsert_sdk_heartbeat via direct fetch to the PostgREST RPC endpoint.
  // Using fetch (not supabase.rpc) so we can inspect the response and verify
  // the call is actually reaching the database.
  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const rpcHeaders   = {
    'Content-Type':  'application/json',
    'apikey':        serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
  }

  const heartbeat = async (
    p_tenant_id: string,
    p_project_id: string,
    p_platform: string,
    p_device_id: string,
    p_sdk_version: string,
  ) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/upsert_sdk_heartbeat`, {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({ p_tenant_id, p_project_id, p_platform, p_device_id, p_sdk_version, p_last_seen: now }),
    })
    if (!res.ok) {
      console.error('heartbeat rpc failed', res.status, await res.text())
    }
  }

  const heartbeatCalls: Promise<void>[] = [
    // 1. Update the layer that actually sent this request.
    heartbeat(tokenRow.tenant_id, project.id, platform, `events-proxy-${platform}`, sdkVersion),
  ]

  // 2. Frontend traffic → also mark the backend layer as active.
  //    The web app is serving users, so its backend API is running too.
  if (FRONTEND_PLATFORMS.has(platform)) {
    heartbeatCalls.push(
      heartbeat(tokenRow.tenant_id, project.id, 'nodejs', 'events-proxy-backend', '0'),
    )
  }

  // 3. Also advance the Database SDK layer if the project has a connected
  //    database connector — traffic flowing means the app (and its DB) is live.
  const { data: connector } = await supabase
    .from('database_connectors')
    .select('engine, tenant_projects!inner(tenant_id)')
    .eq('project_id', project.id)
    .eq('status', 'connected')
    .maybeSingle()

  if (connector) {
    const tenantId = (connector.tenant_projects as unknown as { tenant_id: string }).tenant_id
    heartbeatCalls.push(
      heartbeat(tenantId, project.id, connector.engine, 'db-connector', '1.0.0'),
    )
  }

  await Promise.all(heartbeatCalls)

  // Background: real DB connection test for health metrics — kept separate
  // so it doesn't slow down the response.
  const dbCheckPromise = checkAndRecordDbHeartbeat(supabase, project.id)
  // deno-lint-ignore no-explicit-any
  const runtime = globalThis as any
  if (typeof runtime.EdgeRuntime?.waitUntil === 'function') {
    runtime.EdgeRuntime.waitUntil(dbCheckPromise)
  } else {
    dbCheckPromise.catch(() => {})
  }

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
