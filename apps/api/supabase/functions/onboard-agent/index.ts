/**
 * PAAQ Onboarding Agent — a real AI tool-use loop (via OpenRouter) that
 * connects a customer's repo, generates and PRs the SDK integration,
 * configures the database, and verifies frontend/backend/database, driven by
 * one free-text prompt from the dashboard's "Connect Application" flow.
 *
 * Every tool wraps existing, already-real logic — this function does not
 * reimplement repo access, DB testing, or SDK verification, it orchestrates
 * them: repo-connector's OAuth/token storage, _shared/git-providers (incl.
 * the new listTree), _shared/db-engines/pipeline.ts, _shared/sdk-snippets.ts,
 * _shared/repo-understanding.ts, and fix-engine.ts's getRepoAndToken for the
 * PR-write step (always PR-only, never merges — see write_sdk_file_via_pr).
 *
 * Auth model matches repo-connector exactly: dashboard-triggered only, via
 * X-Internal-Secret, never callable directly from a browser — it touches
 * repo tokens and potentially DB secrets read out of a customer's repo.
 *
 * Runs as one long-running invocation per `start`/`continue` call: it drives
 * the tool-use loop turn-by-turn internally (see runLoop) until the run
 * reaches awaiting_input/succeeded/failed or a safety iteration cap,
 * writing every step/message to the DB as it goes so the UI stays live via
 * Realtime even mid-run. No separate polling cron for v1 — see the plan's
 * "Open risk" note if real runs prove this insufficient.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAiConfig, openRouterChat, type ChatMessage } from '../_shared/ai.ts'
import { loadGitAdapter, type GitProvider } from '../_shared/git-providers/load-adapter.ts'
import type { RepoRef } from '../_shared/git-providers/types.ts'
import { getRepoAndToken } from '../_shared/fix-engine.ts'
import { decryptSecret } from '../_shared/crypto.ts'
import { runPipeline, saveDbConnection, type Engine as DbEngine } from '../_shared/db-engines/pipeline.ts'
import { generateSdkSnippet, type Framework } from '../_shared/sdk-snippets.ts'
import { identifyProjectStructure, extractDbConnectionCandidates } from '../_shared/repo-understanding.ts'

// deno-lint-ignore no-explicit-any
type SupabaseClient = any

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const REPO_KEY_ENV = 'REPO_CONNECTOR_ENCRYPTION_KEY'

// Mirrors FRONTEND_PLATFORMS/MOBILE_PLATFORMS/BACKEND_PLATFORMS/DATABASE_PLATFORMS
// in apps/dashboard/components/shell/connected-app-context.tsx — kept in sync
// manually since this is a Deno edge function with no import path into the
// dashboard's TS (same reasoning as mcp-server's copy).
const FRONTEND_PLATFORMS = new Set(['react', 'nextjs', 'vue', 'angular', 'vanilla'])
const MOBILE_PLATFORMS = new Set(['flutter', 'reactnative', 'ios', 'android'])
const BACKEND_PLATFORMS = new Set(['nodejs', 'python', 'go', 'java', 'dotnet', 'ruby', 'other'])

const STEP_KEYS = [
  'connect_repository', 'understand_project', 'generate_sdk', 'configure_connections',
  'verify_backend', 'verify_frontend', 'verify_database', 'start_learning',
  'activate_monitoring', 'remove_setup_page',
] as const
type StepKey = (typeof STEP_KEYS)[number]

const MAX_TURNS = 40 // safety cap on AI round-trips per invocation

function checkInternalSecret(req: Request): boolean {
  const provided = req.headers.get('x-internal-secret') ?? ''
  const expected = Deno.env.get('REPO_CONNECTOR_INTERNAL_SECRET') ?? ''
  return expected.length > 0 && provided === expected
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)
  if (!checkInternalSecret(req)) return respond({ error: 'Unauthorized' }, 401)

  const body = await req.json().catch(() => ({}))
  const action = body.action as string

  try {
    if (action === 'start') return await handleStart(body)
    if (action === 'continue') return await handleContinue(body)
    if (action === 'provide_input') return await handleProvideInput(body)
    if (action === 'cancel') return await handleCancel(body)
    return respond({ error: 'Unknown action' }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return respond({ ok: false, error: message }, 500)
  }
})

// ── Actions ──────────────────────────────────────────────────────────────

async function handleStart(body: Record<string, unknown>): Promise<Response> {
  const tenantId = body.tenant_id as string
  const projectId = body.project_id as string
  const createdBy = body.created_by as string
  const prompt = (body.prompt as string ?? '').trim()
  if (!tenantId || !projectId || !createdBy) return respond({ ok: false, error: 'tenant_id, project_id, and created_by are required' }, 400)
  if (!prompt) return respond({ ok: false, error: 'prompt is required' }, 400)

  const { data: run, error: runErr } = await supabase.from('onboarding_runs').insert({
    tenant_id: tenantId, project_id: projectId, created_by: createdBy, prompt, status: 'running',
    current_step: STEP_KEYS[0],
  }).select('id').single()
  if (runErr || !run) return respond({ ok: false, error: runErr?.message ?? 'Failed to create run' }, 500)

  await supabase.from('onboarding_run_steps').insert(
    STEP_KEYS.map((step_key, i) => ({ run_id: run.id, step_key, step_order: i, status: 'pending' })),
  )
  await appendMessage(run.id, 'user', [{ type: 'text', text: prompt }])

  await runLoop(run.id, tenantId, projectId)
  return respond({ ok: true, run_id: run.id })
}

async function handleContinue(body: Record<string, unknown>): Promise<Response> {
  const runId = body.run_id as string
  if (!runId) return respond({ ok: false, error: 'run_id is required' }, 400)
  const { data: run } = await supabase.from('onboarding_runs').select('tenant_id, project_id, status').eq('id', runId).maybeSingle()
  if (!run) return respond({ ok: false, error: 'Run not found' }, 404)
  if (run.status === 'succeeded' || run.status === 'failed' || run.status === 'cancelled') {
    return respond({ ok: true, run_id: runId, status: run.status })
  }
  await supabase.from('onboarding_runs').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', runId)
  await runLoop(runId, run.tenant_id, run.project_id)
  return respond({ ok: true, run_id: runId })
}

/** User answered an ask_user question (repo pick, pasted DB connection string, "check again", etc). */
async function handleProvideInput(body: Record<string, unknown>): Promise<Response> {
  const runId = body.run_id as string
  const answer = body.answer as unknown
  if (!runId) return respond({ ok: false, error: 'run_id is required' }, 400)
  const { data: run } = await supabase.from('onboarding_runs').select('tenant_id, project_id, status').eq('id', runId).maybeSingle()
  if (!run) return respond({ ok: false, error: 'Run not found' }, 404)

  await appendMessage(runId, 'user', [{ type: 'text', text: JSON.stringify(answer) }])
  await supabase.from('onboarding_runs').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', runId)
  await runLoop(runId, run.tenant_id, run.project_id)
  return respond({ ok: true, run_id: runId })
}

async function handleCancel(body: Record<string, unknown>): Promise<Response> {
  const runId = body.run_id as string
  if (!runId) return respond({ ok: false, error: 'run_id is required' }, 400)
  await supabase.from('onboarding_runs').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', runId)
  return respond({ ok: true })
}

// ── DB helpers ───────────────────────────────────────────────────────────

async function appendMessage(runId: string, role: 'user' | 'assistant' | 'tool', content: unknown[]): Promise<void> {
  await supabase.from('onboarding_run_messages').insert({ run_id: runId, role, content: redactSecrets(content) })
}

async function loadMessages(runId: string): Promise<{ role: 'user' | 'assistant'; content: unknown }[]> {
  const { data } = await supabase
    .from('onboarding_run_messages')
    .select('role, content')
    .eq('run_id', runId)
    .order('created_at', { ascending: true })
  return (data ?? []).map((m: { role: string; content: unknown }) => ({
    role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
    content: m.content,
  }))
}

async function updateStep(runId: string, stepKey: StepKey, patch: Record<string, unknown>): Promise<void> {
  const now = new Date().toISOString()
  const full = { ...patch }
  if (patch.status === 'running' && !patch.started_at) full.started_at = now
  if ((patch.status === 'done' || patch.status === 'failed' || patch.status === 'skipped') && !patch.finished_at) full.finished_at = now
  await supabase.from('onboarding_run_steps').update(full).eq('run_id', runId).eq('step_key', stepKey)
  await supabase.from('onboarding_runs').update({ current_step: stepKey, updated_at: now }).eq('id', runId)
}

async function setRunStatus(runId: string, status: string, patch: Record<string, unknown> = {}): Promise<void> {
  await supabase.from('onboarding_runs').update({ status, updated_at: new Date().toISOString(), ...patch }).eq('id', runId)
}

/** Redacts anything shaped like a real DB connection string before it's ever persisted to the tenant-readable transcript. */
function redactSecrets(content: unknown): unknown {
  const json = JSON.stringify(content)
  const redacted = json.replace(/\b\w+:\/\/[^:\s"]+:[^@\s"]+@[^\s"'/]+/g, '[REDACTED]')
  try { return JSON.parse(redacted) } catch { return content }
}

// ── Repo helpers (project_repositories / repository_credentials) ────────

async function getConnectedRepo(projectId: string): Promise<{ provider: GitProvider; repo: RepoRef; token: string } | null> {
  const { data: proj } = await supabase
    .from('project_repositories')
    .select('provider, repo_name, repo_url, default_branch')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .maybeSingle()
  if (!proj?.repo_name) return null

  const { data: cred } = await supabase
    .from('repository_credentials')
    .select('access_ciphertext, access_iv')
    .eq('project_id', projectId)
    .eq('provider', proj.provider)
    .eq('status', 'connected')
    .maybeSingle()
  if (!cred) return null

  const token = await decryptSecret(cred.access_ciphertext, cred.access_iv, REPO_KEY_ENV)
  const repo: RepoRef = { fullName: proj.repo_name, url: proj.repo_url, defaultBranch: proj.default_branch ?? 'main', private: true }
  return { provider: proj.provider as GitProvider, repo, token }
}

// ── The tool-use loop ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the PAAQ onboarding agent. A user gave you one prompt describing an application they want connected to PAAQ (e.g. "Connect my production React frontend, Node.js backend and PostgreSQL database hosted on GitHub"). Your job is to get it fully connected and verified using ONLY the tools you're given — never fabricate results, file contents, credentials, or verification outcomes.

Work through these steps, roughly in order (a tool call itself enforces its own real prerequisites, so don't worry about being perfectly sequential — but don't skip ahead if a prior step clearly hasn't succeeded yet):
1. connect_repository — get the user's repo connected. If it returns awaitingUser, stop your turn; the user will pick a provider/repo in the UI.
2. list_repo_tree / read_repo_file — read enough of the repo (package.json, requirements.txt, docker-compose.yml, .env.example, framework configs) to understand the stack. Only read files a tool actually offers/allows — read_repo_file will refuse anything not relevant or that looks like a secret file.
3. generate_sdk_snippet — once you know the frontend/backend framework(s).
4. write_sdk_file_via_pr — commit the generated snippet and open a PR. This ALWAYS only opens a PR, it never merges — tell the user a PR is open and they (or their CI) need to merge and deploy it before verification can succeed.
5. configure_db_connection — if the user mentioned a database, discover a connection string from the repo. If none is found (very common — most repos don't commit real secrets), you MUST call ask_user to request it. Never invent or guess a connection string.
6. verify_database — once you have a real connection string.
7. verify_backend / verify_frontend — check whether real SDK traffic has arrived yet. If not detected, call ask_user to tell the user to deploy/merge the PR and confirm when ready — do not loop waiting indefinitely.
8. send_test_event — once a layer is verified, send a real confirmation test event.
9. activate_monitoring — call this once at least one of backend/frontend is verified (and the database too, if one was configured) to finish the run successfully.

Always call ask_user instead of guessing when you're not confident — about which directory is the real frontend/backend, which of several repos to use, or any credential. Keep any user-facing text you write concise and concrete, and reference real details (repo name, file paths, framework detected) rather than generic language.`

/** OpenAI function-tool definition sent to OpenRouter. */
type OpenAiTool = {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

function toolDefs(): OpenAiTool[] {
  // deno-lint-ignore no-explicit-any
  const def = (name: string, description: string, parameters: any): OpenAiTool => ({ type: 'function', function: { name, description, parameters } })
  return [
    def('list_repos', 'List repos accessible via a connected git provider token.', { type: 'object', properties: { provider: { type: 'string', enum: ['github', 'gitlab', 'azure', 'bitbucket'] } }, required: ['provider'] }),
    def('connect_repository', 'Check or establish repo connection for this project. If not yet connected, this pauses the run for the user to complete OAuth/repo-pick in the UI.', { type: 'object', properties: { provider: { type: 'string', enum: ['github', 'gitlab', 'azure', 'bitbucket'] }, repoFullName: { type: 'string' } } }),
    def('list_repo_tree', 'List files/dirs in the connected repo.', { type: 'object', properties: { path: { type: 'string' }, recursive: { type: 'boolean' } } }),
    def('read_repo_file', "Read one file's content from the connected repo. Refused for files that look like secrets (keys, bare .env) or aren't relevant.", { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }),
    def('generate_sdk_snippet', 'Generate the PAAQ SDK integration file content for a detected framework.', { type: 'object', properties: { framework: { type: 'string', enum: ['nextjs', 'react', 'vue', 'vanilla', 'nodejs', 'python'] } }, required: ['framework'] }),
    def('write_sdk_file_via_pr', 'Commit the given file(s) to a new branch and open a PR. Never merges.', { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' }, commitMessage: { type: 'string' }, prTitle: { type: 'string' }, prBody: { type: 'string' } }, required: ['path', 'content', 'commitMessage', 'prTitle'] }),
    def('configure_db_connection', 'Scan the repo for a database connection string. Returns candidates; if none has a real (non-placeholder) value, you must ask_user for one.', { type: 'object', properties: {} }),
    def('verify_database', 'Test and save a real database connection string.', { type: 'object', properties: { engine: { type: 'string', enum: ['postgres', 'mysql', 'mongodb', 'sqlite', 'redis', 'supabase'] }, connectionString: { type: 'string' } }, required: ['engine', 'connectionString'] }),
    def('verify_backend', 'Check whether real backend SDK traffic has been seen recently.', { type: 'object', properties: {} }),
    def('verify_frontend', 'Check whether real frontend SDK traffic has been seen recently.', { type: 'object', properties: {} }),
    def('send_test_event', 'Send one real confirmation event through the live ingestion pipeline.', { type: 'object', properties: {} }),
    def('activate_monitoring', 'Finish the run successfully once at least one layer (and the database, if configured) is verified.', { type: 'object', properties: {} }),
    def('ask_user', 'Pause and ask the user a question instead of guessing. Use whenever you are not confident about a choice or need a real credential.', { type: 'object', properties: { question: { type: 'string' }, kind: { type: 'string', enum: ['text', 'confirm', 'choose_provider', 'paste_connection_string'] }, options: { type: 'array', items: { type: 'string' } } }, required: ['question'] }),
  ]
}

// ── Transcript format conversion ─────────────────────────────────────────
// Messages are PERSISTED in block format ({type:'text'|'tool_use'|'tool_result'})
// because the dashboard transcript UI renders that shape directly. These
// adapters convert to/from OpenAI chat messages at the API boundary only.

// deno-lint-ignore no-explicit-any
type Block = Record<string, any>

function blocksToChatMessages(blocks: { role: string; content: unknown }[]): ChatMessage[] {
  const out: ChatMessage[] = []
  for (const m of blocks) {
    // deno-lint-ignore no-explicit-any
    const content = (Array.isArray(m.content) ? m.content : [m.content]) as any[]
    if (m.role === 'assistant') {
      const text = content.filter((b) => b?.type === 'text').map((b) => b.text).join('\n')
      const toolCalls = content
        .filter((b) => b?.type === 'tool_use')
        .map((b) => ({ id: b.id as string, type: 'function' as const, function: { name: b.name as string, arguments: JSON.stringify(b.input ?? {}) } }))
      out.push({ role: 'assistant', ...(text ? { content: text } : {}), ...(toolCalls.length ? { tool_calls: toolCalls } : {}) })
    } else {
      // user + tool rows: split into tool-role messages and plain text
      for (const b of content) {
        if (b && typeof b === 'object' && b.type === 'tool_result') {
          out.push({ role: 'tool', tool_call_id: String(b.tool_use_id), content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '') })
        } else if (b && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string') {
          out.push({ role: 'user', content: b.text })
        }
      }
    }
  }
  return out
}

function assistantResponseToBlocks(message: { content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }): Block[] {
  const blocks: Block[] = []
  if (message.content) blocks.push({ type: 'text', text: message.content })
  for (const call of message.tool_calls ?? []) {
    let input: unknown = {}
    try { input = JSON.parse(call.function.arguments || '{}') } catch { /* leave {} */ }
    blocks.push({ type: 'tool_use', id: call.id, name: call.function.name, input })
  }
  return blocks
}

async function runLoop(runId: string, tenantId: string, projectId: string): Promise<void> {
  const aiConfig = getAiConfig()
  if (!aiConfig) {
    await setRunStatus(runId, 'failed', { error: 'No AI API key configured. Set OPENROUTER_API_KEY in Supabase secrets.' })
    return
  }
  const apiKey = aiConfig.apiKey

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const { data: runRow } = await supabase.from('onboarding_runs').select('status').eq('id', runId).maybeSingle()
    if (!runRow || runRow.status !== 'running') return

    // Convert the persisted block-format transcript to OpenAI chat messages.
    const stored = await loadMessages(runId)
    const history = blocksToChatMessages(stored)
    let response: Awaited<ReturnType<typeof openRouterChat>>
    try {
      response = await openRouterChat({
        apiKey,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
        maxTokens: 4096,
        tools: toolDefs(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await setRunStatus(runId, 'failed', { error: `AI call failed: ${message}` })
      return
    }

    const { message: assistantMsg, finishReason } = response

    if (finishReason === 'length') {
      await setRunStatus(runId, 'failed', { error: 'Agent response was truncated (max_tokens) — try a narrower prompt.' })
      return
    }

    const blocks = assistantResponseToBlocks(assistantMsg)
    const textBlocks = blocks.filter((b) => b.type === 'text')
    const toolUseBlocks = blocks.filter((b) => b.type === 'tool_use')

    if (textBlocks.length > 0) {
      await appendMessage(runId, 'assistant', textBlocks)
    }

    if (toolUseBlocks.length === 0) {
      // The model produced only narration this turn with no tool call — nothing
      // more to drive right now; leave the run 'running' so a later
      // `continue` (or the client polling) can pick it back up, unless a
      // handler already moved status to awaiting_input/succeeded/failed.
      return
    }

    await appendMessage(runId, 'assistant', toolUseBlocks)

    const toolResultBlocks: Block[] = []
    let shouldPause = false
    for (const block of toolUseBlocks) {
      const result = await dispatchTool(block.name, (block.input ?? {}) as Record<string, unknown>, { runId, tenantId, projectId })
      toolResultBlocks.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result.output) })
      if (result.pause) shouldPause = true
    }
    await appendMessage(runId, 'tool', toolResultBlocks)

    if (shouldPause) return // status already set by the handler (awaiting_input/succeeded/failed)
  }

  // Hit the safety cap without reaching a terminal state.
  const { data: runRow } = await supabase.from('onboarding_runs').select('status').eq('id', runId).maybeSingle()
  if (runRow?.status === 'running') {
    await setRunStatus(runId, 'awaiting_input', { error: 'Paused after an extended run — reply to continue.' })
  }
}

type ToolResult = { output: Record<string, unknown>; pause?: boolean }
type ToolCtx = { runId: string; tenantId: string; projectId: string }

async function dispatchTool(name: string, input: Record<string, unknown>, ctx: ToolCtx): Promise<ToolResult> {
  try {
    switch (name) {
      case 'list_repos': return await toolListRepos(input, ctx)
      case 'connect_repository': return await toolConnectRepository(input, ctx)
      case 'list_repo_tree': return await toolListRepoTree(input, ctx)
      case 'read_repo_file': return await toolReadRepoFile(input, ctx)
      case 'generate_sdk_snippet': return await toolGenerateSdkSnippet(input, ctx)
      case 'write_sdk_file_via_pr': return await toolWriteSdkFileViaPr(input, ctx)
      case 'configure_db_connection': return await toolConfigureDbConnection(ctx)
      case 'verify_database': return await toolVerifyDatabase(input, ctx)
      case 'verify_backend': return await toolVerifyLayer('backend', ctx)
      case 'verify_frontend': return await toolVerifyLayer('frontend', ctx)
      case 'send_test_event': return await toolSendTestEvent(ctx)
      case 'activate_monitoring': return await toolActivateMonitoring(ctx)
      case 'ask_user': return await toolAskUser(input, ctx)
      default: return { output: { ok: false, error: `Unknown tool: ${name}` } }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { output: { ok: false, error: message } }
  }
}

// ── Tool implementations ─────────────────────────────────────────────────

async function toolListRepos(input: Record<string, unknown>, ctx: ToolCtx): Promise<ToolResult> {
  const provider = input.provider as GitProvider
  const { data: cred } = await supabase
    .from('repository_credentials')
    .select('access_ciphertext, access_iv')
    .eq('project_id', ctx.projectId).eq('provider', provider).eq('status', 'connected').maybeSingle()
  if (!cred) return { output: { ok: false, error: 'not_connected', needsOAuth: true } }
  const token = await decryptSecret(cred.access_ciphertext, cred.access_iv, REPO_KEY_ENV)
  const adapter = await loadGitAdapter(provider)
  const result = await adapter.listRepos(token)
  return { output: result }
}

async function toolConnectRepository(input: Record<string, unknown>, ctx: ToolCtx): Promise<ToolResult> {
  const existing = await getConnectedRepo(ctx.projectId)
  if (existing) {
    await updateStep(ctx.runId, 'connect_repository', { status: 'done', detail: `Connected to ${existing.repo.fullName}` })
    await updateStep(ctx.runId, 'understand_project', { status: 'running', detail: 'Reading project files…' })
    await supabase.from('onboarding_runs').update({ repo_provider: existing.provider, repo_full_name: existing.repo.fullName }).eq('id', ctx.runId)
    return { output: { ok: true, repo: existing.repo.fullName, provider: existing.provider } }
  }

  const provider = input.provider as GitProvider | undefined
  const repoFullName = input.repoFullName as string | undefined
  if (provider && repoFullName) {
    const { data: cred } = await supabase
      .from('repository_credentials')
      .select('id').eq('project_id', ctx.projectId).eq('provider', provider).eq('status', 'connected').maybeSingle()
    if (cred) {
      await supabase.from('project_repositories').upsert(
        { project_id: ctx.projectId, provider, repo_name: repoFullName, status: 'active' },
        { onConflict: 'project_id,provider' },
      )
      await updateStep(ctx.runId, 'connect_repository', { status: 'done', detail: `Connected to ${repoFullName}` })
      await updateStep(ctx.runId, 'understand_project', { status: 'running', detail: 'Reading project files…' })
      return { output: { ok: true, repo: repoFullName, provider } }
    }
  }

  // No credential at all — the user has to complete OAuth in the dashboard UI.
  await updateStep(ctx.runId, 'connect_repository', { status: 'running', detail: 'Waiting for the user to connect a git provider' })
  await setRunStatus(ctx.runId, 'awaiting_input', { current_step: 'connect_repository' })
  return { output: { ok: false, awaitingUser: true, message: 'No repository connected yet — ask the user to choose a git provider in the UI.' }, pause: true }
}

const TREE_DENY_SEGMENTS = ['node_modules', '.git', 'dist', 'build', 'vendor', '.next', '.turbo', 'coverage']
const FILE_DENY_PATTERN = /(\.pem$|\.key$|id_rsa|^\.env$|\/\.env$|\.aws\/credentials)/i

async function toolListRepoTree(input: Record<string, unknown>, ctx: ToolCtx): Promise<ToolResult> {
  const conn = await getConnectedRepo(ctx.projectId)
  if (!conn) return { output: { ok: false, error: 'No repository connected yet' } }
  const adapter = await loadGitAdapter(conn.provider)
  const path = (input.path as string) ?? ''
  const recursive = Boolean(input.recursive)
  const result = await adapter.listTree(conn.token, conn.repo, path, conn.repo.defaultBranch, { recursive })
  if (!result.ok) return { output: result }

  const entries = result.entries.filter((e) => !TREE_DENY_SEGMENTS.some((seg) => e.path.split('/').includes(seg)))
  await updateStep(ctx.runId, 'understand_project', { status: 'running', detail: `Scanned ${entries.length} entries under "${path || '/'}"` })

  if (recursive) {
    const structure = identifyProjectStructure(entries)
    return { output: { ok: true, entries: entries.slice(0, 300), structureHint: structure } }
  }
  return { output: { ok: true, entries } }
}

async function toolReadRepoFile(input: Record<string, unknown>, ctx: ToolCtx): Promise<ToolResult> {
  const path = input.path as string
  if (!path || FILE_DENY_PATTERN.test(path)) return { output: { ok: false, error: 'This file is not readable (looks like a secret/key file, or an invalid path).' } }
  const conn = await getConnectedRepo(ctx.projectId)
  if (!conn) return { output: { ok: false, error: 'No repository connected yet' } }
  const adapter = await loadGitAdapter(conn.provider)
  const result = await adapter.getFileContent(conn.token, conn.repo, path, conn.repo.defaultBranch)
  if (result.ok) await updateStep(ctx.runId, 'understand_project', { status: 'running', detail: `Read ${path}` })
  return { output: result }
}

async function toolGenerateSdkSnippet(input: Record<string, unknown>, ctx: ToolCtx): Promise<ToolResult> {
  const framework = input.framework as Framework
  const { data: project } = await supabase.from('tenant_projects').select('project_id_key').eq('id', ctx.projectId).maybeSingle()
  const { data: tokenRow } = await supabase.from('access_tokens').select('token').eq('project_id', ctx.projectId).eq('token_type', 'sdk_token').eq('status', 'active').maybeSingle()
  if (!project || !tokenRow) return { output: { ok: false, error: 'No active SDK credentials found for this project' } }

  const content = generateSdkSnippet(framework, tokenRow.token, project.project_id_key)
  await updateStep(ctx.runId, 'understand_project', { status: 'done', detail: `Detected ${framework}` })
  await updateStep(ctx.runId, 'generate_sdk', { status: 'done', detail: `Generated ${framework} SDK snippet`, payload: { framework } })
  await updateStep(ctx.runId, 'configure_connections', { status: 'running', detail: 'Opening a pull request…' })
  return { output: { ok: true, framework, content } }
}

async function toolWriteSdkFileViaPr(input: Record<string, unknown>, ctx: ToolCtx): Promise<ToolResult> {
  const path = input.path as string
  const content = input.content as string
  const commitMessage = (input.commitMessage as string) || 'Add PAAQ SDK integration'
  const prTitle = (input.prTitle as string) || 'Add PAAQ SDK integration'
  const prBody = (input.prBody as string) || 'Automated by the PAAQ onboarding agent. This PR only adds the SDK integration file — nothing else was changed, and nothing is auto-merged.'

  const repoResult = await getRepoAndToken(ctx.projectId)
  if (!repoResult.ok) return { output: { ok: false, error: repoResult.error } }
  const { provider, repo, token } = repoResult
  const adapter = await loadGitAdapter(provider)

  const branch = `paaq-onboarding-${ctx.runId.slice(0, 8)}`
  const branchResult = await adapter.createBranch(token, repo, repo.defaultBranch, branch)
  if (!branchResult.ok) return { output: { ok: false, error: branchResult.error } }

  const commitResult = await adapter.commitFiles(token, repo, branch, [{ path, newContent: content }], commitMessage)
  if (!commitResult.ok) return { output: { ok: false, error: commitResult.error } }

  // Always PR-only — never merges, regardless of the tenant's approval_mode.
  const prResult = await adapter.openPR(token, repo, branch, repo.defaultBranch, prTitle, prBody)
  if (!prResult.ok) return { output: { ok: false, error: prResult.error } }

  await updateStep(ctx.runId, 'configure_connections', { status: 'done', detail: `Opened PR: ${prResult.prUrl}`, payload: { prUrl: prResult.prUrl, prNumber: prResult.prNumber } })
  return { output: { ok: true, prUrl: prResult.prUrl, prNumber: prResult.prNumber } }
}

const DB_MARKER_FILES = ['docker-compose.yml', 'docker-compose.yaml', '.env.example', '.env.sample', 'prisma/schema.prisma']

async function toolConfigureDbConnection(ctx: ToolCtx): Promise<ToolResult> {
  const conn = await getConnectedRepo(ctx.projectId)
  if (!conn) return { output: { ok: false, error: 'No repository connected yet' } }
  const adapter = await loadGitAdapter(conn.provider)

  const treeResult = await adapter.listTree(conn.token, conn.repo, '', conn.repo.defaultBranch, { recursive: true })
  if (!treeResult.ok) return { output: treeResult }
  const structure = identifyProjectStructure(treeResult.entries)
  const filesToRead = structure.candidateFiles.filter((p) => DB_MARKER_FILES.some((m) => p === m || p.endsWith('/' + m)))

  const fileContents: { path: string; content: string }[] = []
  for (const path of filesToRead) {
    const fileResult = await adapter.getFileContent(conn.token, conn.repo, path, conn.repo.defaultBranch)
    if (fileResult.ok) fileContents.push({ path, content: fileResult.content })
  }

  const candidates = extractDbConnectionCandidates(fileContents)
  const literal = candidates.find((c) => c.foundLiteralValue)

  if (literal) {
    await updateStep(ctx.runId, 'configure_connections', { status: 'running', detail: `Found a ${literal.engine} connection string in ${literal.sourceFile}` })
    return { output: { ok: true, foundLiteralValue: true, engine: literal.engine, connectionString: literal.literalValue, sourceFile: literal.sourceFile } }
  }

  const engineHints = candidates.map((c) => c.engine)
  await updateStep(ctx.runId, 'configure_connections', { status: 'running', detail: 'No real database credential found in the repo — needs the user to provide one' })
  return {
    output: {
      ok: false,
      foundLiteralValue: false,
      engineHints,
      message: 'No live database connection string was found in the repo (only placeholders, or none at all). Ask the user to paste their real connection string — never fabricate one.',
    },
  }
}

async function toolVerifyDatabase(input: Record<string, unknown>, ctx: ToolCtx): Promise<ToolResult> {
  const engine = input.engine as DbEngine
  const connectionString = input.connectionString as string
  if (!engine || !connectionString) return { output: { ok: false, error: 'engine and connectionString are required' } }

  const result = await saveDbConnection(supabase, { projectId: ctx.projectId, tenantId: ctx.tenantId, engine, connectionString })
  if (!result.ok) {
    await updateStep(ctx.runId, 'verify_database', { status: 'failed', detail: result.error })
    return { output: result }
  }
  await updateStep(ctx.runId, 'verify_database', { status: 'done', detail: `Connected — ${result.tables.length} tables found`, payload: { tableCount: result.tables.length } })
  await updateStep(ctx.runId, 'configure_connections', { status: 'done', detail: 'Database configured' })
  return { output: { ok: true, tableCount: result.tables.length } }
}

const RECENT_WINDOW_MS = 30 * 60 * 1000

async function toolVerifyLayer(layer: 'backend' | 'frontend', ctx: ToolCtx): Promise<ToolResult> {
  const platforms = layer === 'backend' ? BACKEND_PLATFORMS : new Set([...FRONTEND_PLATFORMS, ...MOBILE_PLATFORMS])
  const { data: installs } = await supabase
    .from('sdk_installations')
    .select('platform, last_seen')
    .eq('project_id', ctx.projectId)
    .in('platform', Array.from(platforms))

  const cutoff = Date.now() - RECENT_WINDOW_MS
  const recent = (installs ?? []).find((i: { last_seen: string }) => new Date(i.last_seen).getTime() > cutoff)
  const stepKey: StepKey = layer === 'backend' ? 'verify_backend' : 'verify_frontend'

  if (recent) {
    await updateStep(ctx.runId, stepKey, { status: 'done', detail: `Real ${layer} traffic detected (${recent.platform})` })
    return { output: { ok: true, detected: true, platform: recent.platform } }
  }
  await updateStep(ctx.runId, stepKey, { status: 'running', detail: `No ${layer} traffic yet — waiting on deploy` })
  return { output: { ok: true, detected: false, message: `No real ${layer} traffic seen yet. This usually means the PR hasn't been merged/deployed yet — ask the user to confirm once it's live, rather than waiting silently.` } }
}

async function toolSendTestEvent(ctx: ToolCtx): Promise<ToolResult> {
  const { data: project } = await supabase.from('tenant_projects').select('project_id_key').eq('id', ctx.projectId).maybeSingle()
  const { data: tokenRow } = await supabase.from('access_tokens').select('token').eq('project_id', ctx.projectId).eq('token_type', 'sdk_token').eq('status', 'active').maybeSingle()
  if (!project || !tokenRow) return { output: { ok: false, error: 'No active SDK credentials found for this project' } }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const res = await fetch(`${supabaseUrl}/functions/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenRow.token}`,
      'X-Project-ID': project.project_id_key,
    },
    body: JSON.stringify([{ event_name: 'onboarding_test_event', session_id: null, properties: { source: 'onboard-agent' }, timestamp: new Date().toISOString() }]),
  }).catch(() => null)
  const ok = !!res && res.ok
  await updateStep(ctx.runId, 'start_learning', { status: ok ? 'done' : 'failed', detail: ok ? 'Test event delivered end-to-end' : 'Test event failed to deliver' })
  return { output: { ok } }
}

async function toolActivateMonitoring(ctx: ToolCtx): Promise<ToolResult> {
  const { data: steps } = await supabase.from('onboarding_run_steps').select('step_key, status').eq('run_id', ctx.runId)
  const byKey = new Map((steps ?? []).map((s: { step_key: string; status: string }) => [s.step_key, s.status]))
  const backendOk = byKey.get('verify_backend') === 'done'
  const frontendOk = byKey.get('verify_frontend') === 'done'
  const dbConfigured = byKey.get('verify_database') !== 'pending' // was attempted at all
  const dbOk = byKey.get('verify_database') === 'done' || !dbConfigured

  if (!backendOk && !frontendOk) {
    return { output: { ok: false, error: 'Neither backend nor frontend is verified yet — cannot activate monitoring.' } }
  }
  if (!dbOk) {
    return { output: { ok: false, error: 'Database verification was started but has not succeeded yet.' } }
  }

  await updateStep(ctx.runId, 'activate_monitoring', { status: 'done', detail: 'Monitoring active' })
  await updateStep(ctx.runId, 'remove_setup_page', { status: 'done', detail: 'Onboarding complete' })
  await setRunStatus(ctx.runId, 'succeeded')
  return { output: { ok: true } }
}

async function toolAskUser(input: Record<string, unknown>, ctx: ToolCtx): Promise<ToolResult> {
  const question = input.question as string
  await setRunStatus(ctx.runId, 'awaiting_input')
  return { output: { ok: true, question, kind: input.kind ?? 'text', options: input.options ?? null }, pause: true }
}

// ── HTTP plumbing ────────────────────────────────────────────────────────

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, x-internal-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors() } })
}
