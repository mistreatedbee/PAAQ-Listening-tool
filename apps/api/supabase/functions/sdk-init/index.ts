/**
 * PAAQ Intelligence Platform — SDK Initialization Handshake
 *
 * Called by any PAAQ SDK on app startup.
 *
 * Required headers:
 *   Authorization:  Bearer sdk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   X-Project-ID:   proj_xxxxxxxx
 *   X-SDK-Version:  1.2.4
 *   X-Platform:     flutter | react | nextjs | android | ios | nodejs
 *   X-Environment:  production | staging | development
 *
 * Optional JSON body:
 *   { "deviceId": "...", "appVersion": "...", "sessionId": "..." }
 *
 * Returns on success (200):
 *   {
 *     ok: true,
 *     sessionId: "<uuid>",
 *     projectId: "<proj_xxx>",
 *     config: { samplingRate, batchSize, syncIntervalSeconds, ... },
 *     features: { aiInsights, journeyTracking, errorCapture, ... }
 *   }
 *
 * Returns on failure:
 *   { ok: false, error: "<message>" }  (401 / 400 / 500)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  if (req.method !== 'POST') return respond({ ok: false, error: 'Method not allowed' }, 405)

  // ── 1. Parse credentials from headers ───────────────────────
  const authHeader = req.headers.get('authorization') ?? ''
  const sdkToken   = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const projectKey = req.headers.get('x-project-id') ?? ''
  const sdkVersion = req.headers.get('x-sdk-version') ?? 'unknown'
  const platform   = (req.headers.get('x-platform') ?? 'other').toLowerCase()
  const environment = (req.headers.get('x-environment') ?? 'production').toLowerCase()

  if (!sdkToken || !projectKey) {
    return respond({ ok: false, error: 'Missing Authorization or X-Project-ID header' }, 401)
  }

  if (!sdkToken.startsWith('sdk_live_') && !sdkToken.startsWith('sdk_test_')) {
    return respond({ ok: false, error: 'Invalid SDK token format' }, 401)
  }

  // ── 2. Validate SDK token against access_tokens ─────────────
  const { data: tokenRow, error: tokenErr } = await sb
    .from('access_tokens')
    .select('id, tenant_id, project_id, status, expires_at, rotation_expires_at')
    .eq('token', sdkToken)
    .eq('token_type', 'sdk_token')
    .in('status', ['active', 'rotating'])
    .single()

  if (tokenErr || !tokenRow) {
    await logEvent('sdk_init_failed', projectKey, { reason: 'invalid_token', platform })
    return respond({ ok: false, error: 'Invalid SDK token' }, 401)
  }

  // If rotating, check the old token hasn't expired yet
  if (tokenRow.status === 'rotating' && tokenRow.rotation_expires_at) {
    if (new Date() > new Date(tokenRow.rotation_expires_at)) {
      return respond({ ok: false, error: 'SDK token has been rotated — please update to the new token' }, 401)
    }
  }

  // ── 3. Validate project ID against tenant_projects ───────────
  const { data: project, error: projectErr } = await sb
    .from('tenant_projects')
    .select('id, tenant_id, name, platform, environment, status')
    .eq('project_id_key', projectKey)
    .eq('tenant_id', tokenRow.tenant_id)
    .single()

  if (projectErr || !project) {
    return respond({ ok: false, error: 'Project not found or does not belong to this token' }, 401)
  }

  if (project.status !== 'active') {
    return respond({ ok: false, error: `Project is ${project.status}` }, 403)
  }

  // ── 4. Validate tenant is active ─────────────────────────────
  const { data: tenant } = await sb
    .from('tenants')
    .select('status, subscription_plan')
    .eq('id', tokenRow.tenant_id)
    .single()

  if (!tenant || tenant.status === 'suspended' || tenant.status === 'churned') {
    return respond({ ok: false, error: 'Account is suspended' }, 403)
  }

  // ── 5. Parse optional body ────────────────────────────────────
  let body: { deviceId?: string; appVersion?: string; sessionId?: string } = {}
  try { body = await req.json() } catch { /* body is optional */ }

  // ── 6. Upsert sdk_installations ──────────────────────────────
  const deviceId = body.deviceId ?? crypto.randomUUID()
  const now = new Date().toISOString()

  await sb.from('sdk_installations').upsert(
    {
      tenant_id:   tokenRow.tenant_id,
      project_id:  project.id,
      sdk_version: sdkVersion,
      platform,
      device_id:   deviceId,
      app_version: body.appVersion ?? null,
      last_seen:   now,
      status:      'active',
    },
    { onConflict: 'tenant_id,project_id,device_id', ignoreDuplicates: false },
  )

  // ── 7. Build remote config (plan-aware) ───────────────────────
  const isPaidPlan = tenant.subscription_plan !== 'starter'

  const config = {
    samplingRate:        100,                      // % of events to capture (0-100)
    batchSize:           50,                       // events per flush
    syncIntervalSeconds: isPaidPlan ? 5 : 30,      // flush frequency
    maxQueueSize:        500,                      // in-memory queue cap
    enableNetworkCapture: isPaidPlan,              // automatic API call tracking
    enableCrashCapture:   true,
    enableANR:            platform === 'android',  // Application Not Responding
    enableSessionReplay:  false,                   // future
    logLevel:            environment === 'production' ? 'error' : 'debug',
  }

  const features = {
    aiInsights:       true,
    journeyTracking:  isPaidPlan,
    errorCapture:     true,
    performanceProfiling: isPaidPlan,
    userIdentification: true,
    customEvents:     true,
    webhookBridge:    isPaidPlan,
  }

  // ── 8. Generate session ID ────────────────────────────────────
  const sessionId = body.sessionId ?? crypto.randomUUID()

  await logEvent('sdk_init_success', projectKey, { platform, sdkVersion, environment })

  return respond({
    ok:         true,
    sessionId,
    projectId:  projectKey,
    deviceId,
    config,
    features,
    meta: {
      plan:        tenant.subscription_plan,
      projectName: project.name,
      serverTime:  now,
    },
  })
})

async function logEvent(action: string, projectKey: string, details: Record<string, unknown>) {
  await sb.from('admin_audit_log').insert({
    action,
    resource_type: 'sdk',
    resource_name: projectKey,
    details,
  }).catch(() => {/* non-blocking */})
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
