/**
 * PAAQ Execute Fix — generates a real code change grounded in the actual
 * connected repo, opens it as a branch + PR, and (on a separate, gated
 * call) merges it. Dashboard-triggered only — never called directly from
 * a browser; the Next.js routes in app/api/fix/* check session + role
 * first, then forward here with the internal shared secret.
 *
 * Actions: generate | open_pr | merge | status
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { askModel, getAiConfig } from '../_shared/ai.ts'
import { loadGitAdapter } from '../_shared/git-providers/load-adapter.ts'
import type { RepoRef } from '../_shared/git-providers/types.ts'
import { getRepoAndToken, getApprovalMode, markFailed, performMerge, recordMerge, type RecRow } from '../_shared/fix-engine.ts'
import { exploreAndPlan, executeNextStep } from '../_shared/agentic-fix.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

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
  const recommendationId = body.recommendationId as string
  const actingUserId = body.actingUserId as string | undefined

  if (!recommendationId) return respond({ error: 'recommendationId is required' }, 400)

  try {
    const { data: rec } = await supabase.from('recommendations').select('*').eq('id', recommendationId).single()
    if (!rec) return respond({ ok: false, error: 'Recommendation not found' }, 404)

    // Advisory mode is the real trust boundary: AI may only ever suggest —
    // enforced here, not just by hiding a button in the dashboard. A
    // request with a perfectly valid internal secret still gets refused.
    if (action === 'open_pr' || action === 'merge') {
      const mode = await getApprovalMode(rec.project_id)
      if (mode === 'advisory') {
        return respond({ ok: false, error: 'This project is in Advisory mode — AI fixes are suggestion-only. Switch to Assisted, Team, or Autonomous mode to open PRs.' }, 403)
      }
    }

    if (action === 'generate') return await handleGenerate(rec as RecRow, body.filePath as string | undefined)
    if (action === 'open_pr') return await handleOpenPr(rec as RecRow, body.changeset)
    if (action === 'merge') return await handleMergeAction(rec as RecRow, actingUserId ?? null, !!body.allowUnknownChecks)
    if (action === 'status') return await handleStatus(rec as RecRow)
    if (action === 'start_run') return await handleStartRun(rec as RecRow, body.filePath as string | undefined)
    if (action === 'approve_plan') return await handleApprovePlan(body.runId as string, rec as RecRow)
    if (action === 'continue_run') return await handleContinueRun(body.runId as string, rec as RecRow)
    if (action === 'get_run') return await handleGetRun(body.runId as string)
    if (action === 'reject_plan') {
      await supabase.from('fix_runs').update({ status: 'failed', error: 'Rejected by user', updated_at: new Date().toISOString() }).eq('id', body.runId as string)
      return respond({ ok: true })
    }
    return respond({ error: 'Unknown action' }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return respond({ ok: false, error: message }, 500)
  }
})

/** Extracts a likely bare filename from free-text recommendation copy (e.g. "checkout.dart:142"). */
function guessFilename(text: string): string | null {
  const m = text.match(/([a-zA-Z0-9_\-]+\.(dart|ts|tsx|js|jsx|py|go|rb|java|kt))\b/)
  return m ? m[1] : null
}

/** Extracts a likely app route/page path from free-text copy (e.g. "/dashboard/health drop-off"). */
function guessRoutePath(text: string): string | null {
  const matches = text.match(/\/[a-zA-Z0-9][a-zA-Z0-9_\-\/]*/g) ?? []
  // Prefer the longest slash-path with no file extension — routes, not asset/URL fragments.
  const routes = matches.filter((m) => !/\.[a-zA-Z0-9]+$/.test(m) && m.split('/').filter(Boolean).length >= 1)
  if (routes.length === 0) return null
  return routes.sort((a, b) => b.length - a.length)[0]
}

/** GitHub-only tree search by basename — the one provider verified live in this environment. */
async function findFileInGithub(token: string, repo: RepoRef, basename: string, ref: string): Promise<string[]> {
  const tree = await fetchGithubTree(token, repo, ref)
  return tree.filter((t) => t.type === 'blob' && t.path.split('/').pop() === basename).map((t) => t.path)
}

/**
 * Resolves a route path like "/dashboard/health" to candidate source files by matching the
 * route's segments against the repo tree, favoring conventional page/route entrypoints
 * (Next.js app-router `page.*`/`route.*`, or an `index.*` file) over incidental matches.
 */
async function findFileForRoute(token: string, repo: RepoRef, routePath: string, ref: string): Promise<string[]> {
  const segments = routePath.split('/').filter(Boolean)
  if (segments.length === 0) return []
  const tree = await fetchGithubTree(token, repo, ref)
  const segPattern = segments.join('/')
  const matches = tree.filter((t) => t.type === 'blob' && t.path.includes(segPattern))
  if (matches.length === 0) return []

  const entrypoint = /(^|\/)(page|route|index)\.(tsx|ts|jsx|js)$/
  const entrypoints = matches.filter((t) => entrypoint.test(t.path))
  const ranked = entrypoints.length > 0 ? entrypoints : matches
  return ranked.map((t) => t.path)
}

async function fetchGithubTree(token: string, repo: RepoRef, ref: string): Promise<{ path: string; type: string }[]> {
  const res = await fetch(`https://api.github.com/repos/${repo.fullName}/git/trees/${encodeURIComponent(ref)}?recursive=1`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) return []
  const body = await res.json().catch(() => ({}))
  return (body?.tree ?? []) as { path: string; type: string }[]
}

// Files over this line count use surgical patch mode instead of full-file rewrite,
// preventing silent truncation when the model's output limit is hit.
const LARGE_FILE_LINE_THRESHOLD = 100

type PatchEntry = { search: string; replace: string }

function applyPatches(
  content: string,
  patches: PatchEntry[],
): { ok: true; content: string } | { ok: false; error: string } {
  let result = content
  for (const patch of patches) {
    if (!result.includes(patch.search)) {
      return { ok: false, error: `Patch target not found: "${patch.search.slice(0, 80)}"` }
    }
    result = result.replace(patch.search, patch.replace)
  }
  return { ok: true, content: result }
}

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|py|go|dart|rb|java|kt|swift|cs|vue|svelte|rs)$/
const STOP_WORDS = new Set([
  'the','and','for','with','this','that','from','into','could','should',
  'would','enable','validate','verify','check','ensure','fix','add','update',
  'improve','implement','resolve','handle','support','apply','review','use',
  'make','get','set','run','all','not','new','old','via','its','the','our',
  'your','their','will','has','had','have','been','was','are','can',
])

/**
 * Scores repo files against keywords extracted from the recommendation title/description.
 * Returns up to 8 best-matching source files for the AI to choose from.
 */
async function findFilesByKeywords(token: string, repo: RepoRef, title: string, description: string | null): Promise<string[]> {
  const text = `${title} ${description ?? ''}`.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  const words = (text.match(/[a-z]{3,}/g) ?? []).filter((w) => !STOP_WORDS.has(w))
  if (words.length === 0) return []

  const tree = await fetchGithubTree(token, repo, repo.defaultBranch)
  const sourceFiles = tree.filter((t) => t.type === 'blob' && SOURCE_EXT.test(t.path))

  type Scored = { path: string; score: number }
  const scored: Scored[] = sourceFiles.map((f) => {
    const p = f.path.toLowerCase()
    const score = words.filter((w) => p.includes(w)).length
    return { path: f.path, score }
  }).filter((f) => f.score > 0)

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 8).map((f) => f.path)
}

/**
 * Uses the AI model to pick the single most relevant file from a list of candidates.
 * Falls back to the first candidate if anything goes wrong.
 */
async function aiPickBestFile(
  apiKey: string,
  candidates: string[],
  rec: RecRow,
): Promise<string> {
  if (candidates.length === 1) return candidates[0]

  const context = [
    `Recommendation: ${rec.title}`,
    rec.description ? `Description: ${rec.description}` : '',
    rec.root_cause ? `Root cause: ${rec.root_cause}` : '',
    rec.affected_files?.length
      ? `Known affected files: ${rec.affected_files.map((f) => `${f.path}${f.function ? ` (${f.function})` : ''}`).join(', ')}`
      : '',
  ].filter(Boolean).join('\n')

  try {
    const picked = await askModel({
      prompt: `You are selecting which source file a code fix should be applied to.

${context}

Candidate files:
${candidates.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Reply with ONLY the exact file path of the best match — nothing else, no explanation.`,
      maxTokens: 4096,
    })
    const trimmed = picked.trim()
    return candidates.find((c) => c === trimmed) ?? candidates[0]
  } catch {
    return candidates[0]
  }
}

async function handleGenerate(rec: RecRow, explicitPath?: string) {
  const repoResult = await getRepoAndToken(rec.project_id)
  if (!repoResult.ok) return respond({ ok: false, error: repoResult.error })
  const { provider, repo, token } = repoResult

  const aiConfig = getAiConfig()
  if (!aiConfig) return respond({ ok: false, error: 'No AI API key configured. Set OPENROUTER_API_KEY in Supabase secrets.' }, 500)
  const apiKey = aiConfig.apiKey

  let filePath = explicitPath

  // Use pre-identified files from the AI investigation first.
  if (!filePath && rec.affected_files && rec.affected_files.length > 0) {
    filePath = await aiPickBestFile(apiKey, rec.affected_files.map((f) => f.path), rec)
  }

  if (!filePath) {
    if (provider !== 'github') {
      return respond({ ok: false, needsFileSelection: true, candidates: [], error: 'Specify the full repo-relative path for this file.' })
    }

    const text = `${rec.title} ${rec.description ?? ''}`
    const basename = guessFilename(text)
    const routePath = guessRoutePath(text)

    let candidates: string[] = []
    if (basename) candidates = await findFileInGithub(token, repo, basename, repo.defaultBranch)
    if (candidates.length === 0 && routePath) candidates = await findFileForRoute(token, repo, routePath, repo.defaultBranch)
    if (candidates.length === 0) candidates = await findFilesByKeywords(token, repo, rec.title, rec.description)

    if (candidates.length === 0) {
      return respond({ ok: false, needsFileSelection: true, candidates: [], error: 'Could not find a matching file in the repo — type the path below.' })
    }

    // Auto-pick the best candidate; only surface the picker as a last resort.
    filePath = await aiPickBestFile(apiKey, candidates, rec)
  }

  const fileResult = await (await loadGitAdapter(provider)).getFileContent(token, repo, filePath, repo.defaultBranch)
  if (!fileResult.ok) return respond({ ok: false, error: fileResult.error })

  const patchPlanText = rec.patch_plan?.length
    ? `\nPatch plan from investigation:\n${rec.patch_plan.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
    : ''

  const rootCauseText = rec.root_cause ? `\nRoot cause: ${rec.root_cause}` : ''

  const affectedFnText = rec.affected_files?.find((f) => f.path === filePath)?.function
    ? `\nTarget function: ${rec.affected_files.find((f) => f.path === filePath)!.function}`
    : ''

  const fileLines = fileResult.content.split('\n').length
  const isLargeFile = fileLines > LARGE_FILE_LINE_THRESHOLD
  const fileContext = fileResult.content.slice(0, 14000)

  const recContext = `Recommendation:
  Title: ${rec.title}
  Type: ${rec.type}
  Description: ${rec.description ?? 'none'}${rootCauseText}${affectedFnText}${patchPlanText}`

  const prompt = isLargeFile
    ? `You are the PAAQ Fix Agent. Apply a surgical patch to this file — do NOT rewrite the whole file.

${recContext}

File: ${filePath} (${fileLines} lines)
Current content:
\`\`\`
${fileContext}
\`\`\`

Return ONLY this JSON, no markdown, no explanation:
{
  "summary": "one sentence describing the fix",
  "confidence": 0-100,
  "mode": "patch",
  "patches": [
    { "search": "exact verbatim substring to find in the file", "replace": "replacement string" }
  ]
}

Rules:
- Each "search" MUST be an exact verbatim copy from the file above (any character difference will fail)
- Make each search string long enough to be unique in the file — include 2-3 lines of surrounding context
- Only change what is necessary — minimal surgical change
- Do NOT include the full file content — only the targeted patch(es)`
    : `You are the PAAQ Fix Agent. Given a recommendation and the current file content, produce a concrete, targeted code fix.

${recContext}

File: ${filePath}
Current content:
\`\`\`
${fileContext}
\`\`\`

Return ONLY this JSON structure, no markdown, no explanation:
{
  "summary": "one sentence describing the fix",
  "confidence": 0-100,
  "changes": [ { "path": "${filePath}", "newContent": "<the complete file content after the fix>" } ]
}

Rules:
- newContent must be the COMPLETE file after the fix, not a diff or snippet
- Only change what is necessary to address the recommendation — minimal surgical change
- If you cannot confidently produce a fix, set confidence below 40 and explain why in summary`

  const raw = await askModel({
    prompt,
    maxTokens: isLargeFile ? 8000 : 16000,
  })
  if (!raw) return respond({ ok: false, error: 'No response from AI' }, 500)

  let parsed: {
    summary: string
    confidence: number
    mode?: string
    patches?: PatchEntry[]
    changes?: { path: string; newContent: string }[]
  }
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Models sometimes wrap JSON in a stray sentence despite instructions;
    // fall back to the outermost {...} span before giving up.
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      return respond({ ok: false, error: 'Failed to parse AI response' }, 500)
    }
    try {
      parsed = JSON.parse(raw.slice(start, end + 1))
    } catch {
      return respond({ ok: false, error: 'Failed to parse AI response' }, 500)
    }
  }

  let changes: { path: string; newContent: string }[]

  if (parsed.mode === 'patch' && parsed.patches?.length) {
    const applied = applyPatches(fileResult.content, parsed.patches)
    if (!applied.ok) return respond({ ok: false, error: `Patch failed: ${applied.error}` }, 500)
    changes = [{ path: filePath, newContent: applied.content }]
  } else {
    changes = parsed.changes ?? []
  }

  if (changes.length === 0 || changes.length > 5) {
    return respond({ ok: false, error: 'Change set is empty or too large' }, 400)
  }

  await supabase.from('recommendations').update({ fix_changeset: changes }).eq('id', rec.id)
  // Original content (already in memory, pre-patch) so the dashboard can
  // render a real before/after diff without a second round-trip. Always
  // one entry today (single-file scope), kept as an array for forward
  // compat with multi-file generation.
  return respond({
    ok: true,
    summary: parsed.summary,
    confidence: parsed.confidence,
    changes,
    original: [{ path: filePath, content: fileResult.content }],
  })
}

async function handleOpenPr(rec: RecRow, overrideChangeset?: { path: string; newContent: string }[]) {
  const repoResult = await getRepoAndToken(rec.project_id)
  if (!repoResult.ok) return respond({ ok: false, error: repoResult.error })
  const { provider, repo, token } = repoResult

  // Never trust a stale stored token without re-checking it works right now.
  const adapter = await loadGitAdapter(provider)
  const verify = await adapter.verifyToken(token)
  if (!verify.ok) return respond({ ok: false, error: `Stored credential no longer works: ${verify.error}` })

  const changeset = overrideChangeset ?? rec.fix_changeset
  if (!changeset || changeset.length === 0) return respond({ ok: false, error: 'No changeset to open a PR with — call generate first' }, 400)

  const branch = `paaq-fix-${rec.id.slice(0, 8)}`

  const branchResult = await adapter.createBranch(token, repo, repo.defaultBranch, branch)
  if (!branchResult.ok) {
    await markFailed(rec.id, branchResult.error)
    return respond({ ok: false, error: branchResult.error })
  }

  const commitResult = await adapter.commitFiles(token, repo, branch, changeset, `PAAQ: ${rec.title}`)
  if (!commitResult.ok) {
    await markFailed(rec.id, commitResult.error)
    return respond({ ok: false, error: commitResult.error })
  }

  const prResult = await adapter.openPR(
    token, repo, branch, repo.defaultBranch,
    `PAAQ fix: ${rec.title}`,
    `${rec.description ?? ''}\n\n_Generated by PAAQ Intelligence — review before merging._`,
  )
  if (!prResult.ok) {
    await markFailed(rec.id, prResult.error)
    return respond({ ok: false, error: prResult.error })
  }

  await supabase.from('recommendations').update({
    fix_branch: branch,
    fix_pr_url: prResult.prUrl,
    fix_pr_number: prResult.prNumber,
    fix_pr_state: 'open',
    fix_error: null,
  }).eq('id', rec.id)

  return respond({ ok: true, prUrl: prResult.prUrl, prNumber: prResult.prNumber, branch })
}

async function handleMergeAction(rec: RecRow, actingUserId: string | null, allowUnknownChecks: boolean) {
  const result = await performMerge(rec, { allowUnknownChecks, actingUserId })
  return respond(result)
}

async function handleStatus(rec: RecRow) {
  // Live re-fetch (mirrors performMerge) rather than trusting cached DB
  // fields, so the dashboard can poll this while waiting for CI checks.
  if (!rec.fix_pr_number || rec.fix_pr_state !== 'open') {
    return respond({
      fixPrState: rec.fix_pr_state,
      fixPrUrl: rec.fix_pr_url,
      fixBranch: rec.fix_branch,
      fixError: (rec as unknown as { fix_error?: string }).fix_error ?? null,
      checksPassed: null,
      checksPending: false,
      checksSupported: false,
    })
  }

  const repoResult = await getRepoAndToken(rec.project_id)
  if (!repoResult.ok) {
    return respond({
      fixPrState: rec.fix_pr_state, fixPrUrl: rec.fix_pr_url, fixBranch: rec.fix_branch,
      fixError: (rec as unknown as { fix_error?: string }).fix_error ?? null,
      checksPassed: null, checksPending: false, checksSupported: false,
    })
  }
  const { provider, repo, token } = repoResult
  const adapter = await loadGitAdapter(provider)
  const status = await adapter.getPRStatus(token, repo, rec.fix_pr_number)

  if (!status.ok) {
    return respond({
      fixPrState: rec.fix_pr_state, fixPrUrl: rec.fix_pr_url, fixBranch: rec.fix_branch,
      fixError: (rec as unknown as { fix_error?: string }).fix_error ?? null,
      checksPassed: null, checksPending: false, checksSupported: false, statusError: status.error,
    })
  }

  // Keep the DB row in sync if the PR was merged/closed outside PAAQ. A
  // merge specifically needs the full completion flow (recommendation
  // status, deployment_registry) — not just flipping fix_pr_state — or the
  // rec sits in 'pending' forever and Deployment Intelligence never learns
  // the change shipped, even once GitHub confirms it did.
  if (status.state === 'merged' && rec.fix_pr_state !== 'merged') {
    // No commitSha here — PAAQ never called mergePR() itself for a merge it
    // only detected after the fact, so there's no merge response to read
    // one from. checksPassed/checksSupported are real, though — same
    // getPRStatus() call already fetched above.
    await recordMerge(rec, {
      actingUserId: null,
      validationPassed: status.checksPassed,
      validationResults: { checksPassed: status.checksPassed, checksPending: status.checksPending ?? false, checksSupported: status.checksSupported },
    })
  } else if (status.state !== 'open' && status.state !== rec.fix_pr_state) {
    await supabase.from('recommendations').update({ fix_pr_state: status.state }).eq('id', rec.id)
  }

  return respond({
    fixPrState: status.state,
    fixPrUrl: rec.fix_pr_url,
    fixBranch: rec.fix_branch,
    fixError: (rec as unknown as { fix_error?: string }).fix_error ?? null,
    checksPassed: status.checksPassed,
    checksPending: status.checksPending ?? false,
    checksSupported: status.checksSupported,
    mergeable: status.mergeable,
  })
}

/**
 * Real, persisted, agentic fix generation — replaces the old single-shot
 * `handleGenerate` heuristic-file-guess-then-flat-prompt flow. Explores the
 * repo, proposes a concrete plan, and stops for human approval before
 * writing anything. Runs synchronously within this request (same proven
 * pattern as onboard-agent's runLoop) — the explore phase is bounded to a
 * small number of AI turns, so it comfortably finishes within one
 * invocation; the dashboard subscribes to the fix_runs row via Realtime for
 * live progress rather than waiting on this response alone.
 */
async function handleStartRun(rec: RecRow, explicitPath?: string) {
  const repoResult = await getRepoAndToken(rec.project_id)
  if (!repoResult.ok) return respond({ ok: false, error: repoResult.error })
  const { provider, repo, token } = repoResult

  const aiConfig = getAiConfig()
  if (!aiConfig) return respond({ ok: false, error: 'No AI API key configured. Set OPENROUTER_API_KEY in Supabase secrets.' }, 500)
  const apiKey = aiConfig.apiKey

  const { data: run, error: insertError } = await supabase
    .from('fix_runs')
    .insert({ recommendation_id: rec.id, project_id: rec.project_id, status: 'exploring' })
    .select('*')
    .single()
  if (insertError || !run) return respond({ ok: false, error: insertError?.message ?? 'Failed to create fix run' }, 500)

  await exploreAndPlan(run.id, rec, provider, repo, token, explicitPath)

  const { data: finalRun } = await supabase.from('fix_runs').select('*').eq('id', run.id).maybeSingle()
  return respond({ ok: true, run: finalRun })
}

/** Executes an already-approved plan step by step — the only action in this
 * whole pipeline that actually generates code, and only after a human has
 * seen and approved the specific plan being executed. */
async function handleApprovePlan(runId: string, rec: RecRow) {
  if (!runId) return respond({ ok: false, error: 'runId is required' }, 400)

  const { data: run } = await supabase.from('fix_runs').select('status').eq('id', runId).maybeSingle()
  if (!run) return respond({ ok: false, error: 'Fix run not found' }, 404)
  if (run.status !== 'awaiting_plan_approval') return respond({ ok: false, error: `Run is not awaiting approval (status: ${run.status})` }, 400)

  await supabase.from('fix_runs').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', runId)
  return await runOneStep(runId, rec)
}

/** Executes exactly one step of an already-running plan and returns —
 * never the whole plan in one request. A real multi-step plan (each step
 * costing several sequential AI calls) reliably exceeded the edge
 * function's execution limit when run as a single request, leaving the run
 * stuck 'running' forever with nothing surfaced to the user ("I click
 * approve and nothing happens"). The dashboard calls this repeatedly,
 * driven by the fix_runs row it's already subscribed to via Realtime,
 * until `done` comes back true. */
async function handleContinueRun(runId: string, rec: RecRow) {
  if (!runId) return respond({ ok: false, error: 'runId is required' }, 400)

  const { data: run } = await supabase.from('fix_runs').select('status').eq('id', runId).maybeSingle()
  if (!run) return respond({ ok: false, error: 'Fix run not found' }, 404)
  if (run.status !== 'running') return respond({ ok: true, run, done: run.status === 'completed' || run.status === 'failed' })

  return await runOneStep(runId, rec)
}

async function runOneStep(runId: string, rec: RecRow) {
  const repoResult = await getRepoAndToken(rec.project_id)
  if (!repoResult.ok) return respond({ ok: false, error: repoResult.error })
  const { provider, repo, token } = repoResult

  const aiConfig = getAiConfig()
  if (!aiConfig) return respond({ ok: false, error: 'No AI API key configured. Set OPENROUTER_API_KEY in Supabase secrets.' }, 500)
  const apiKey = aiConfig.apiKey

  const { done } = await executeNextStep(runId, rec, provider, repo, token)

  const { data: finalRun } = await supabase.from('fix_runs').select('*').eq('id', runId).maybeSingle()
  return respond({ ok: true, run: finalRun, done })
}

async function handleGetRun(runId: string) {
  if (!runId) return respond({ ok: false, error: 'runId is required' }, 400)
  const { data: run } = await supabase.from('fix_runs').select('*').eq('id', runId).maybeSingle()
  if (!run) return respond({ ok: false, error: 'Fix run not found' }, 404)
  return respond({ ok: true, run })
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, x-internal-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
}
