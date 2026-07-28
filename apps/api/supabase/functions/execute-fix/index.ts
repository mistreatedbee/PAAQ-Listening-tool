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
import Anthropic from 'npm:@anthropic-ai/sdk'
import { decryptSecret } from '../_shared/crypto.ts'
import { loadGitAdapter, type GitProvider } from '../_shared/git-providers/load-adapter.ts'
import { categorizeGitError } from '../_shared/git-providers/types.ts'
import type { RepoRef } from '../_shared/git-providers/types.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const KEY_ENV = 'REPO_TOKEN_ENCRYPTION_KEY'

function checkInternalSecret(req: Request): boolean {
  const provided = req.headers.get('x-internal-secret') ?? ''
  const expected = Deno.env.get('REPO_CONNECTOR_INTERNAL_SECRET') ?? ''
  return expected.length > 0 && provided === expected
}

type RecRow = {
  id: string
  project_id: string
  title: string
  description: string | null
  type: string
  fix_changeset: { path: string; newContent: string }[] | null
  fix_branch: string | null
  fix_pr_url: string | null
  fix_pr_number: number | null
  fix_pr_state: string
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

    if (action === 'generate') return await handleGenerate(rec as RecRow, body.filePath as string | undefined)
    if (action === 'open_pr') return await handleOpenPr(rec as RecRow, body.changeset)
    if (action === 'merge') return await handleMerge(rec as RecRow, actingUserId)
    if (action === 'status') return await handleStatus(rec as RecRow)
    return respond({ error: 'Unknown action' }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return respond({ ok: false, error: message }, 500)
  }
})

async function getRepoAndToken(projectId: string): Promise<
  | { ok: true; provider: GitProvider; repo: RepoRef; token: string }
  | { ok: false; error: string }
> {
  const { data: proj } = await supabase
    .from('project_repositories')
    .select('provider, repo_name, repo_url, default_branch')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .maybeSingle()
  if (!proj?.repo_name) return { ok: false, error: 'No repository connected for this project' }

  const { data: cred } = await supabase
    .from('repository_credentials')
    .select('access_ciphertext, access_iv')
    .eq('project_id', projectId)
    .eq('provider', proj.provider)
    .eq('status', 'connected')
    .maybeSingle()
  if (!cred) return { ok: false, error: 'No credential stored for the connected repository' }

  const token = await decryptSecret(cred.access_ciphertext, cred.access_iv, KEY_ENV)
  const repo: RepoRef = { fullName: proj.repo_name, url: proj.repo_url, defaultBranch: proj.default_branch ?? 'main', private: true }
  return { ok: true, provider: proj.provider as GitProvider, repo, token }
}

/** Extracts a likely bare filename from free-text recommendation copy (e.g. "checkout.dart:142"). */
function guessFilename(text: string): string | null {
  const m = text.match(/([a-zA-Z0-9_\-]+\.(dart|ts|tsx|js|jsx|py|go|rb|java|kt))\b/)
  return m ? m[1] : null
}

/** GitHub-only tree search by basename — the one provider verified live in this environment. */
async function findFileInGithub(token: string, repo: RepoRef, basename: string, ref: string): Promise<string[]> {
  const res = await fetch(`https://api.github.com/repos/${repo.fullName}/git/trees/${encodeURIComponent(ref)}?recursive=1`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) return []
  const body = await res.json().catch(() => ({}))
  const tree = (body?.tree ?? []) as { path: string; type: string }[]
  return tree.filter((t) => t.type === 'blob' && t.path.split('/').pop() === basename).map((t) => t.path)
}

async function handleGenerate(rec: RecRow, explicitPath?: string) {
  const repoResult = await getRepoAndToken(rec.project_id)
  if (!repoResult.ok) return respond({ ok: false, error: repoResult.error })
  const { provider, repo, token } = repoResult

  let filePath = explicitPath
  if (!filePath) {
    const basename = guessFilename(`${rec.title} ${rec.description ?? ''}`)
    if (!basename) {
      return respond({ ok: false, needsFileSelection: true, candidates: [], error: 'Could not identify a file from this recommendation — specify a file path.' })
    }
    if (provider === 'github') {
      const candidates = await findFileInGithub(token, repo, basename, repo.defaultBranch)
      if (candidates.length === 0) {
        return respond({ ok: false, needsFileSelection: true, candidates: [], error: `No file named "${basename}" found in the repo.` })
      }
      if (candidates.length > 1) {
        return respond({ ok: false, needsFileSelection: true, candidates, error: `Multiple files named "${basename}" found — pick one.` })
      }
      filePath = candidates[0]
    } else {
      // Non-GitHub providers: no tree-search implemented yet — ask the human to confirm the path.
      return respond({ ok: false, needsFileSelection: true, candidates: [basename], error: 'Specify the full repo-relative path for this file.' })
    }
  }

  const fileResult = await (await loadGitAdapter(provider)).getFileContent(token, repo, filePath, repo.defaultBranch)
  if (!fileResult.ok) return respond({ ok: false, error: fileResult.error })

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return respond({ ok: false, error: 'ANTHROPIC_API_KEY not set' }, 500)

  const prompt = `You are the PAAQ Fix Agent. Given a recommendation and the real current content of the file it likely affects, propose a concrete code fix.

Recommendation:
  Title: ${rec.title}
  Type: ${rec.type}
  Description: ${rec.description ?? 'none'}

File: ${filePath}
Current content:
\`\`\`
${fileResult.content.slice(0, 12000)}
\`\`\`

Return ONLY this JSON structure, no markdown, no explanation:
{
  "summary": "one sentence describing the fix",
  "confidence": 0-100,
  "changes": [ { "path": "${filePath}", "newContent": "<the full file content after applying the fix>" } ]
}

Rules:
- newContent must be the COMPLETE file after the fix, not a diff or snippet
- Only change what's necessary to address the recommendation
- If you cannot confidently produce a fix, set confidence below 40 and explain why in summary`

  const anthropic = new Anthropic({ apiKey })
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  })
  const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.replace(/```json?\n?/g, '').replace(/```/g, '').trim() : null
  if (!raw) return respond({ ok: false, error: 'No response from Claude' }, 500)

  let result: { summary: string; confidence: number; changes: { path: string; newContent: string }[] }
  try {
    result = JSON.parse(raw)
  } catch {
    return respond({ ok: false, error: 'Failed to parse Claude response' }, 500)
  }

  if (!result.changes || result.changes.length === 0 || result.changes.length > 5) {
    return respond({ ok: false, error: 'Change set is empty or too large' }, 400)
  }

  await supabase.from('recommendations').update({ fix_changeset: result.changes }).eq('id', rec.id)
  return respond({ ok: true, summary: result.summary, confidence: result.confidence, changes: result.changes })
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

async function markFailed(recId: string, error: string) {
  await supabase.from('recommendations').update({ fix_pr_state: 'failed', fix_error: error }).eq('id', recId)
}

async function handleMerge(rec: RecRow, actingUserId?: string) {
  if (!rec.fix_pr_number) return respond({ ok: false, error: 'No open PR to merge' }, 400)

  const repoResult = await getRepoAndToken(rec.project_id)
  if (!repoResult.ok) return respond({ ok: false, error: repoResult.error })
  const { provider, repo, token } = repoResult
  const adapter = await loadGitAdapter(provider)

  // Never trust cached fix_pr_state — re-fetch real status first.
  const status = await adapter.getPRStatus(token, repo, rec.fix_pr_number)
  if (!status.ok) return respond({ ok: false, error: status.error })
  if (status.state === 'merged') {
    await supabase.from('recommendations').update({ fix_pr_state: 'merged' }).eq('id', rec.id)
    return respond({ ok: true, alreadyMerged: true })
  }
  if (status.state === 'closed') {
    await supabase.from('recommendations').update({ fix_pr_state: 'closed' }).eq('id', rec.id)
    return respond({ ok: false, error: 'PR was closed without merging' })
  }

  const mergeResult = await adapter.mergePR(token, repo, rec.fix_pr_number)
  if (!mergeResult.ok) {
    const category = categorizeGitError(400, mergeResult.error)
    await markFailed(rec.id, mergeResult.error)
    return respond({
      ok: false,
      blockedByProtection: category === 'blocked_by_protection',
      error: mergeResult.error,
    })
  }

  const now = new Date().toISOString()
  await supabase.from('recommendations').update({
    status: 'approved',
    approved_by: actingUserId ?? null,
    approved_at: now,
    fix_pr_state: 'merged',
    fix_merged_at: now,
    fix_error: null,
  }).eq('id', rec.id)

  return respond({ ok: true, merged: true })
}

async function handleStatus(rec: RecRow) {
  return respond({
    fixPrState: rec.fix_pr_state,
    fixPrUrl: rec.fix_pr_url,
    fixBranch: rec.fix_branch,
    fixError: (rec as unknown as { fix_error?: string }).fix_error ?? null,
  })
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
