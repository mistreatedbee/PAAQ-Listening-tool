import type {
  GitAdapter, RepoRef, RepoFile, TestResult, ListReposResult, GetFileResult, OpenPrResult, PrStatusResult, TreeEntry, ListTreeResult,
} from './types.ts'
import { categorizeGitError } from './types.ts'

const API = 'https://api.github.com'

const EXCLUDED_SEGMENTS = ['node_modules', '.git', 'dist', 'build', 'vendor', '.next', '.turbo', 'coverage']
const MAX_TREE_ENTRIES = 2000

function isExcludedPath(path: string): boolean {
  const segments = path.split('/')
  return EXCLUDED_SEGMENTS.some((seg) => segments.includes(seg))
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
}
function fromBase64(b64: string): string {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))))
}

async function ghFetch(path: string, token: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers(token), ...(init.headers ?? {}) } })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

async function verifyToken(token: string): Promise<TestResult> {
  const { ok, status, body } = await ghFetch('/user', token)
  if (ok) return { ok: true }
  return { ok: false, error: body?.message ?? `GitHub auth check failed (${status})` }
}

async function listRepos(token: string): Promise<ListReposResult> {
  const { ok, status, body } = await ghFetch('/user/repos?per_page=100&sort=updated', token)
  if (!ok) return { ok: false, error: body?.message ?? `GitHub list repos failed (${status})` }
  const repos: RepoRef[] = (body as any[]).map((r) => ({
    id: r.id,
    fullName: r.full_name,
    url: r.html_url,
    defaultBranch: r.default_branch,
    private: r.private,
  }))
  return { ok: true, repos }
}

async function getFileContent(token: string, repo: RepoRef, path: string, ref: string): Promise<GetFileResult> {
  const { ok, status, body } = await ghFetch(`/repos/${repo.fullName}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`, token)
  if (!ok) return { ok: false, error: body?.message ?? `GitHub get file failed (${status})` }
  return { ok: true, content: fromBase64(body.content), sha: body.sha }
}

async function listTree(token: string, repo: RepoRef, path: string, ref: string, opts?: { recursive?: boolean }): Promise<ListTreeResult> {
  if (opts?.recursive) {
    const { ok, status, body } = await ghFetch(`/repos/${repo.fullName}/git/trees/${encodeURIComponent(ref)}?recursive=1`, token)
    if (!ok) return { ok: false, error: body?.message ?? `GitHub list tree failed (${status})` }
    const entries: TreeEntry[] = []
    for (const item of (body?.tree ?? [])) {
      if (item.type !== 'blob' && item.type !== 'tree') continue
      if (isExcludedPath(item.path)) continue
      entries.push({ path: item.path, type: item.type === 'blob' ? 'file' : 'dir', size: item.size })
      if (entries.length >= MAX_TREE_ENTRIES) break
    }
    return { ok: true, entries }
  }
  const p = path ? `/${encodeURIComponent(path)}` : ''
  const { ok, status, body } = await ghFetch(`/repos/${repo.fullName}/contents${p}?ref=${encodeURIComponent(ref)}`, token)
  if (!ok) return { ok: false, error: body?.message ?? `GitHub list tree failed (${status})` }
  const items: any[] = Array.isArray(body) ? body : [body]
  const entries: TreeEntry[] = []
  for (const item of items) {
    if (!item?.path || isExcludedPath(item.path)) continue
    entries.push({ path: item.path, type: item.type === 'dir' ? 'dir' : 'file', size: item.size })
    if (entries.length >= MAX_TREE_ENTRIES) break
  }
  return { ok: true, entries }
}

async function createBranch(token: string, repo: RepoRef, fromRef: string, newBranch: string): Promise<TestResult> {
  const ref = await ghFetch(`/repos/${repo.fullName}/git/ref/heads/${encodeURIComponent(fromRef)}`, token)
  if (!ref.ok) return { ok: false, error: ref.body?.message ?? `GitHub get ref failed (${ref.status})` }
  const sha = ref.body.object.sha
  const created = await ghFetch(`/repos/${repo.fullName}/git/refs`, token, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha }),
  })
  if (!created.ok) return { ok: false, error: created.body?.message ?? `GitHub create branch failed (${created.status})` }
  return { ok: true }
}

async function commitFiles(token: string, repo: RepoRef, branch: string, files: RepoFile[], message: string): Promise<TestResult> {
  // No atomic multi-file commit on this API — sequential per-file PUTs.
  // A mid-loop failure leaves a partial branch; acceptable since it's a
  // throwaway branch surfaced as fix_pr_state='failed'.
  for (const file of files) {
    const existing = await ghFetch(`/repos/${repo.fullName}/contents/${encodeURIComponent(file.path)}?ref=${encodeURIComponent(branch)}`, token)
    const body: Record<string, unknown> = {
      message,
      content: toBase64(file.newContent),
      branch,
    }
    if (existing.ok) body.sha = existing.body.sha
    const put = await ghFetch(`/repos/${repo.fullName}/contents/${encodeURIComponent(file.path)}`, token, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    if (!put.ok) return { ok: false, error: put.body?.message ?? `GitHub commit failed for ${file.path} (${put.status})` }
  }
  return { ok: true }
}

async function openPR(token: string, repo: RepoRef, branch: string, baseBranch: string, title: string, body: string): Promise<OpenPrResult> {
  const res = await ghFetch(`/repos/${repo.fullName}/pulls`, token, {
    method: 'POST',
    body: JSON.stringify({ title, head: branch, base: baseBranch, body }),
  })
  if (!res.ok) return { ok: false, error: res.body?.message ?? `GitHub open PR failed (${res.status})` }
  return { ok: true, prUrl: res.body.html_url, prNumber: res.body.number }
}

/**
 * Real CI-check status for a commit — combines the legacy Status API
 * (Travis-style external CI) with the modern Checks API (GitHub Actions),
 * since a repo may use either or both. A hard failure on either source
 * wins; "nothing configured on either" is null (no CI), not "unknown."
 */
async function fetchChecksPassed(token: string, repo: RepoRef, sha: string): Promise<{ passed: boolean | null; pending: boolean }> {
  const [statusRes, checksRes] = await Promise.all([
    ghFetch(`/repos/${repo.fullName}/commits/${encodeURIComponent(sha)}/status`, token),
    ghFetch(`/repos/${repo.fullName}/commits/${encodeURIComponent(sha)}/check-runs`, token),
  ])
  const combinedState: string | null = statusRes.ok ? statusRes.body?.state ?? null : null
  const checkRuns: { status: string; conclusion: string | null }[] = checksRes.ok ? (checksRes.body?.check_runs ?? []) : []

  const anyHardFail =
    combinedState === 'failure' || combinedState === 'error' ||
    checkRuns.some((c) => ['failure', 'timed_out', 'cancelled', 'action_required'].includes(c.conclusion ?? ''))
  if (anyHardFail) return { passed: false, pending: false }

  const hasAnySignal = (combinedState != null && combinedState !== 'pending') || checkRuns.length > 0
  const anyPending = combinedState === 'pending' || checkRuns.some((c) => c.status !== 'completed')
  if (!hasAnySignal && !anyPending) return { passed: null, pending: false } // no CI configured at all
  if (anyPending) return { passed: null, pending: true }

  const allGood = (combinedState == null || combinedState === 'success') &&
    checkRuns.every((c) => ['success', 'neutral', 'skipped'].includes(c.conclusion ?? ''))
  return { passed: allGood, pending: false }
}

async function getPRStatus(token: string, repo: RepoRef, prNumber: number): Promise<PrStatusResult> {
  const res = await ghFetch(`/repos/${repo.fullName}/pulls/${prNumber}`, token)
  if (!res.ok) return { ok: false, error: res.body?.message ?? `GitHub get PR failed (${res.status})` }
  const state: 'open' | 'merged' | 'closed' = res.body.merged ? 'merged' : res.body.state === 'closed' ? 'closed' : 'open'
  const sha: string | undefined = res.body.head?.sha
  const checks = sha ? await fetchChecksPassed(token, repo, sha) : { passed: null, pending: false }
  return {
    ok: true,
    state,
    mergeable: res.body.mergeable ?? null,
    checksPassed: checks.passed,
    checksPending: checks.pending,
    checksSupported: true,
  }
}

async function mergePR(token: string, repo: RepoRef, prNumber: number): Promise<TestResult> {
  const res = await ghFetch(`/repos/${repo.fullName}/pulls/${prNumber}/merge`, token, {
    method: 'PUT',
    body: JSON.stringify({ merge_method: 'squash' }),
  })
  if (!res.ok) {
    // A 405 here typically means branch protection blocked it — this is
    // the expected safe-failure path, not a bug to route around.
    return { ok: false, error: res.body?.message ?? `GitHub merge failed (${res.status})` }
  }
  return { ok: true }
}

export const githubAdapter: GitAdapter = {
  verifyToken, listRepos, getFileContent, listTree, createBranch, commitFiles, openPR, getPRStatus, mergePR,
}

export { categorizeGitError }
