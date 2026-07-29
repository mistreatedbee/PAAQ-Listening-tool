/**
 * PAAQ Deployment Webhook
 *
 * Accepts incoming webhooks from Vercel, GitHub Actions, Netlify, Docker Hub,
 * and a generic format, and writes normalised rows into deployment_registry.
 *
 * Webhook URL:
 *   POST https://<project>.supabase.co/functions/v1/deployment-webhook?projectKey=proj_xxx
 *
 * The projectKey query param identifies which tenant project this deployment
 * belongs to — customers copy this from their Setup page.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

type DeployRow = {
  project_id: string
  version: string
  environment: string
  deployed_at: string
  deployed_by: string | null
  status: string
  git_commit: string | null
  git_tag: string | null
  release_notes: string | null
  changed_features: string[] | null
  source: string
}

// ── Source parsers ──────────────────────────────────────────────────────────

function parseVercel(body: Record<string, unknown>): Partial<DeployRow> {
  const d = (body.payload as Record<string, unknown>)?.deployment as Record<string, unknown> ?? body
  const meta = (d.meta ?? {}) as Record<string, string>
  const state = String((body.payload as Record<string, unknown>)?.type ?? body.type ?? '')

  const status =
    state.endsWith('succeeded') || state.endsWith('ready') ? 'success'
    : state.endsWith('failed') || state.endsWith('error') ? 'failed'
    : 'pending'

  return {
    version: String(d.name ?? d.id ?? 'deployment'),
    environment: String(d.target ?? meta.githubCommitRef ?? 'production'),
    deployed_at: new Date().toISOString(),
    deployed_by: meta.githubCommitAuthorName ?? null,
    status,
    git_commit: meta.githubCommitSha?.slice(0, 7) ?? null,
    release_notes: meta.githubCommitMessage ?? null,
    source: 'vercel',
  }
}

function parseGitHubActions(body: Record<string, unknown>, event: string): Partial<DeployRow> {
  const dep = body.deployment as Record<string, unknown> ?? {}
  const depStatus = body.deployment_status as Record<string, unknown> ?? {}
  const workflow = body.workflow_run as Record<string, unknown> ?? {}

  const state = String(depStatus.state ?? workflow.conclusion ?? body.action ?? '')
  const status =
    state === 'success' || state === 'completed' ? 'success'
    : state === 'failure' || state === 'failed' ? 'failed'
    : 'pending'

  return {
    version: String(dep.ref ?? dep.sha?.toString().slice(0, 7) ?? workflow.head_sha?.toString().slice(0, 7) ?? 'workflow'),
    environment: String(dep.environment ?? depStatus.environment ?? 'production'),
    deployed_at: String(depStatus.created_at ?? dep.created_at ?? new Date().toISOString()),
    deployed_by: (body.sender as Record<string, unknown>)?.login?.toString() ?? null,
    status,
    git_commit: dep.sha?.toString().slice(0, 7) ?? workflow.head_sha?.toString().slice(0, 7) ?? null,
    release_notes: dep.description?.toString() ?? workflow.name?.toString() ?? null,
    source: 'github-actions',
  }
}

function parseNetlify(body: Record<string, unknown>): Partial<DeployRow> {
  const state = String(body.state ?? body.deploy_state ?? '')
  const status =
    state === 'ready' || state === 'uploaded' ? 'success'
    : state === 'error' ? 'failed'
    : 'pending'

  return {
    version: String(body.deploy_id ?? body.id ?? 'deploy'),
    environment: String(body.context ?? body.branch ?? 'production'),
    deployed_at: String(body.published_at ?? body.created_at ?? new Date().toISOString()),
    deployed_by: null,
    status,
    git_commit: body.commit_ref?.toString().slice(0, 7) ?? null,
    git_tag: null,
    release_notes: body.title?.toString() ?? null,
    source: 'netlify',
  }
}

function parseDocker(body: Record<string, unknown>): Partial<DeployRow> {
  return {
    version: String(body.tag ?? body.push_data?.tag ?? 'latest'),
    environment: 'production',
    deployed_at: new Date().toISOString(),
    deployed_by: String(body.pusher ?? body.actor ?? ''),
    status: 'success',
    git_commit: null,
    release_notes: `Docker image pushed: ${body.repository?.repo_name ?? body.name ?? 'image'}`,
    source: 'docker',
  }
}

function parseGeneric(body: Record<string, unknown>): Partial<DeployRow> {
  const status = String(body.status ?? body.state ?? 'success')
  return {
    version: String(body.version ?? body.tag ?? body.ref ?? body.id ?? 'deployment'),
    environment: String(body.environment ?? body.env ?? 'production'),
    deployed_at: String(body.deployed_at ?? body.timestamp ?? new Date().toISOString()),
    deployed_by: String(body.deployed_by ?? body.author ?? body.actor ?? ''),
    status: status === 'success' || status === 'completed' ? 'success'
      : status === 'failed' || status === 'error' ? 'failed'
      : 'success',
    git_commit: body.commit?.toString().slice(0, 7) ?? body.sha?.toString().slice(0, 7) ?? null,
    git_tag: body.tag?.toString() ?? null,
    release_notes: body.message?.toString() ?? body.description?.toString() ?? null,
    source: String(body.source ?? 'generic'),
  }
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors() })
  }
  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, 405)
  }

  const url = new URL(req.url)
  const projectKey = url.searchParams.get('projectKey')
  if (!projectKey) {
    return respond({ error: 'projectKey query param required — copy it from your Setup page' }, 400)
  }

  // Resolve project — accept either the short project_id_key (proj_xxx) or the raw UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectKey)
  const { data: proj } = await supabase
    .from('tenant_projects')
    .select('id')
    .eq(isUuid ? 'id' : 'project_id_key', projectKey)
    .maybeSingle()
  if (!proj) return respond({ error: 'Project not found for this projectKey' }, 404)

  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  // Detect source from headers
  const vercelSig  = req.headers.get('x-vercel-signature')
  const githubEvent = req.headers.get('x-github-event')
  const netlifyHdr = req.headers.get('x-netlify-signature') ?? req.headers.get('x-netlify-event')
  const dockerHdr  = req.headers.get('x-docker-event')

  let parsed: Partial<DeployRow>

  if (vercelSig) {
    parsed = parseVercel(body)
  } else if (githubEvent) {
    parsed = parseGitHubActions(body, githubEvent)
  } else if (netlifyHdr || body.deploy_id) {
    parsed = parseNetlify(body)
  } else if (dockerHdr || body.callback_url?.toString().includes('hub.docker')) {
    parsed = parseDocker(body)
  } else {
    parsed = parseGeneric(body)
  }

  // Skip non-terminal events (e.g. GitHub "created" before "completed")
  if (parsed.status === 'pending' && !url.searchParams.has('includePending')) {
    return respond({ ok: true, skipped: true, reason: 'pending event — not recorded' })
  }

  const row: DeployRow = {
    project_id: proj.id,
    version:      parsed.version      ?? 'deployment',
    environment:  parsed.environment  ?? 'production',
    deployed_at:  parsed.deployed_at  ?? new Date().toISOString(),
    deployed_by:  parsed.deployed_by  ?? null,
    status:       parsed.status       ?? 'success',
    git_commit:   parsed.git_commit   ?? null,
    git_tag:      parsed.git_tag      ?? null,
    release_notes: parsed.release_notes ?? null,
    changed_features: parsed.changed_features ?? null,
    source:       (parsed as { source?: string }).source ?? 'webhook',
  }

  const { error } = await supabase.from('deployment_registry').insert(row)
  if (error) return respond({ ok: false, error: error.message }, 500)

  return respond({ ok: true, deployment: { version: row.version, environment: row.environment, status: row.status } })
})

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, x-vercel-signature, x-hub-signature-256, x-github-event, x-netlify-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
}
