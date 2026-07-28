import type {
  GitAdapter, RepoRef, RepoFile, TestResult, ListReposResult, GetFileResult, OpenPrResult, PrStatusResult,
} from './types.ts'
import { categorizeGitError } from './types.ts'

const API = 'https://api.github.com'

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

async function getPRStatus(token: string, repo: RepoRef, prNumber: number): Promise<PrStatusResult> {
  const res = await ghFetch(`/repos/${repo.fullName}/pulls/${prNumber}`, token)
  if (!res.ok) return { ok: false, error: res.body?.message ?? `GitHub get PR failed (${res.status})` }
  const state: 'open' | 'merged' | 'closed' = res.body.merged ? 'merged' : res.body.state === 'closed' ? 'closed' : 'open'
  return { ok: true, state, mergeable: res.body.mergeable ?? null, checksPassed: null }
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
  verifyToken, listRepos, getFileContent, createBranch, commitFiles, openPR, getPRStatus, mergePR,
}

export { categorizeGitError }
