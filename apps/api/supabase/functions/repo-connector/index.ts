/**
 * PAAQ Repository Connector — stores encrypted git provider tokens, lists
 * repos, and records which one a project is linked to.
 *
 * Unlike db-connector (SDK-token authenticated, callable by any SDK/MCP
 * client), this function is dashboard-triggered only. It must never be
 * callable directly from a browser — the Next.js server routes that call
 * it first check the user's session, then forward here with an internal
 * shared secret. That secret is the only auth this function checks.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encryptSecret, decryptSecret } from '../_shared/crypto.ts'
import { loadGitAdapter, type GitProvider } from '../_shared/git-providers/load-adapter.ts'
import type { RepoRef } from '../_shared/git-providers/types.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const KEY_ENV = 'REPO_CONNECTOR_ENCRYPTION_KEY'

function checkInternalSecret(req: Request): boolean {
  const provided = req.headers.get('x-internal-secret') ?? ''
  const expected = Deno.env.get('REPO_CONNECTOR_INTERNAL_SECRET') ?? ''
  return expected.length > 0 && provided === expected
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)
  if (!checkInternalSecret(req)) return respond({ error: 'Unauthorized' }, 401)

  const body = await req.json().catch(() => ({}))
  const action = body.action as string
  const projectId = body.project_id as string
  const provider = body.provider as GitProvider

  if (!projectId) return respond({ error: 'project_id is required' }, 400)

  try {
    if (action === 'store_token') return await handleStoreToken(projectId, provider, body)
    if (action === 'list_repos') return await handleListRepos(projectId, provider)
    if (action === 'select_repo') return await handleSelectRepo(projectId, provider, body)
    if (action === 'status') return await handleStatus(projectId, provider)
    if (action === 'disconnect') return await handleDisconnect(projectId, provider)
    return respond({ error: 'Unknown action' }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return respond({ ok: false, error: message }, 500)
  }
})

async function handleStoreToken(projectId: string, provider: GitProvider, body: Record<string, unknown>) {
  const accessToken = body.accessToken as string
  if (!accessToken) return respond({ ok: false, error: 'accessToken is required' }, 400)

  const adapter = await loadGitAdapter(provider)
  const verify = await adapter.verifyToken(accessToken)
  if (!verify.ok) return respond({ ok: false, error: verify.error }, 400)

  const { ciphertext, iv } = await encryptSecret(accessToken, KEY_ENV)
  let refresh: { ciphertext: string; iv: string } | null = null
  if (body.refreshToken) refresh = await encryptSecret(body.refreshToken as string, KEY_ENV)

  await supabase.from('repository_credentials').upsert(
    {
      project_id: projectId,
      provider,
      access_ciphertext: ciphertext,
      access_iv: iv,
      refresh_ciphertext: refresh?.ciphertext ?? null,
      refresh_iv: refresh?.iv ?? null,
      token_expires_at: body.expiresAt ?? null,
      scopes: body.scopes ?? null,
      status: 'connected',
      last_verified_at: new Date().toISOString(),
      last_verify_ok: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id,provider' },
  )

  return respond({ ok: true })
}

async function getDecryptedToken(projectId: string, provider: GitProvider): Promise<string | null> {
  const { data } = await supabase
    .from('repository_credentials')
    .select('access_ciphertext, access_iv')
    .eq('project_id', projectId)
    .eq('provider', provider)
    .eq('status', 'connected')
    .single()
  if (!data) return null
  return decryptSecret(data.access_ciphertext, data.access_iv, KEY_ENV)
}

async function handleListRepos(projectId: string, provider: GitProvider) {
  const token = await getDecryptedToken(projectId, provider)
  if (!token) return respond({ ok: false, error: 'No connected credential for this provider' }, 404)

  const adapter = await loadGitAdapter(provider)
  const result = await adapter.listRepos(token)
  if (!result.ok) return respond({ ok: false, error: result.error })
  // Normalise to snake_case so the dashboard UI can use repo.full_name / repo.default_branch consistently.
  const repos = result.repos.map((r) => ({
    full_name: r.fullName,
    default_branch: r.defaultBranch ?? 'main',
    private: r.private ?? false,
  }))
  return respond({ ok: true, repos })
}

async function handleSelectRepo(projectId: string, provider: GitProvider, body: Record<string, unknown>) {
  const repo = body.repo as RepoRef
  if (!repo?.fullName) return respond({ ok: false, error: 'repo is required' }, 400)

  // Auto-register a real webhook on the provider side so every push/deploy
  // on this repo is reported back automatically — no manual CI/CD webhook
  // setup required. Best-effort: a failure here doesn't block connecting
  // the repo, it just means automatic tracking isn't live for it yet.
  let webhookId: string | null = null
  const token = await getDecryptedToken(projectId, provider)
  if (token) {
    try {
      const { data: project } = await supabase
        .from('tenant_projects')
        .select('project_id_key')
        .eq('id', projectId)
        .maybeSingle()
      if (project?.project_id_key) {
        const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/deployment-webhook?projectKey=${project.project_id_key}`
        const adapter = await loadGitAdapter(provider)
        const hookResult = await adapter.createWebhook(token, repo, callbackUrl)
        if (hookResult.ok) webhookId = hookResult.webhookId
        else console.error(`repo-connector: webhook registration failed for ${repo.fullName}`, hookResult.error)
      }
    } catch (e) {
      console.error(`repo-connector: webhook registration threw for ${repo.fullName}`, e)
    }
  }

  await supabase.from('project_repositories').upsert(
    {
      project_id: projectId,
      provider,
      repo_name: repo.fullName,
      repo_url: repo.url,
      default_branch: repo.defaultBranch,
      status: 'active',
      webhook_id: webhookId,
    },
    { onConflict: 'project_id,provider' },
  )
  return respond({ ok: true, webhookRegistered: webhookId !== null })
}

async function handleStatus(projectId: string, provider: GitProvider) {
  const { data } = await supabase
    .from('project_repositories')
    .select('provider, repo_name, repo_url, connected_at, status')
    .eq('project_id', projectId)
    .eq('provider', provider)
    .eq('status', 'active')
    .maybeSingle()

  const { data: cred } = await supabase
    .from('repository_credentials')
    .select('last_verified_at, last_verify_ok, status')
    .eq('project_id', projectId)
    .eq('provider', provider)
    .maybeSingle()

  return respond({
    connected: !!cred && cred.status === 'connected',
    repoName: data?.repo_name ?? null,
    repoUrl: data?.repo_url ?? null,
    lastVerifiedAt: cred?.last_verified_at ?? null,
  })
}

async function handleDisconnect(projectId: string, provider: GitProvider) {
  // Best-effort: remove the webhook we registered so disconnecting doesn't
  // leave an orphaned hook pointing at PAAQ on the customer's repo.
  try {
    const { data: proj } = await supabase
      .from('project_repositories')
      .select('repo_name, repo_url, default_branch, webhook_id')
      .eq('project_id', projectId)
      .eq('provider', provider)
      .maybeSingle()
    if (proj?.webhook_id) {
      const token = await getDecryptedToken(projectId, provider)
      if (token) {
        const repo: RepoRef = { fullName: proj.repo_name, url: proj.repo_url, defaultBranch: proj.default_branch ?? 'main', private: true }
        const adapter = await loadGitAdapter(provider)
        await adapter.deleteWebhook(token, repo, proj.webhook_id)
      }
    }
  } catch (e) {
    console.error(`repo-connector: webhook cleanup failed on disconnect for project ${projectId}`, e)
  }

  await supabase.from('repository_credentials').update({ status: 'disabled', updated_at: new Date().toISOString() }).eq('project_id', projectId).eq('provider', provider)
  await supabase.from('project_repositories').update({ status: 'inactive', webhook_id: null }).eq('project_id', projectId).eq('provider', provider)
  return respond({ ok: true })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, x-internal-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}
