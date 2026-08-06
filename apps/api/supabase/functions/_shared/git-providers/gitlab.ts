// Implemented against the documented GitLab REST API contract. Unlike
// GitHub, this has never been exercised against a live GitLab instance in
// this environment — treat as beta/unverified until smoke-tested with
// real credentials (see plan verification notes).
import type {
  GitAdapter, RepoRef, RepoFile, TestResult, ListReposResult, GetFileResult, OpenPrResult, PrStatusResult, TreeEntry, ListTreeResult,
} from './types.ts'

const API = 'https://gitlab.com/api/v4'

const EXCLUDED_SEGMENTS = ['node_modules', '.git', 'dist', 'build', 'vendor', '.next', '.turbo', 'coverage']
const MAX_TREE_ENTRIES = 2000

function isExcludedPath(path: string): boolean {
  const segments = path.split('/')
  return EXCLUDED_SEGMENTS.some((seg) => segments.includes(seg))
}

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

// GitLab accepts the URL-encoded full path (namespace/project) as :id.
function projectId(repo: RepoRef): string {
  return encodeURIComponent(repo.fullName)
}

async function glFetch(path: string, token: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers(token), ...(init.headers ?? {}) } })
  const contentType = res.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json') ? await res.json().catch(() => ({})) : await res.text()
  return { ok: res.ok, status: res.status, body }
}

async function verifyToken(token: string): Promise<TestResult> {
  const { ok, status, body } = await glFetch('/user', token)
  if (ok) return { ok: true }
  return { ok: false, error: body?.message ?? `GitLab auth check failed (${status})` }
}

async function listRepos(token: string): Promise<ListReposResult> {
  const { ok, status, body } = await glFetch('/projects?membership=true&per_page=100', token)
  if (!ok) return { ok: false, error: body?.message ?? `GitLab list projects failed (${status})` }
  const repos: RepoRef[] = (body as any[]).map((p) => ({
    id: p.id,
    fullName: p.path_with_namespace,
    url: p.web_url,
    defaultBranch: p.default_branch,
    private: p.visibility !== 'public',
  }))
  return { ok: true, repos }
}

async function getFileContent(token: string, repo: RepoRef, path: string, ref: string): Promise<GetFileResult> {
  const res = await glFetch(`/projects/${projectId(repo)}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(ref)}`, token)
  if (!res.ok) return { ok: false, error: typeof res.body === 'string' ? res.body : `GitLab get file failed (${res.status})` }
  return { ok: true, content: typeof res.body === 'string' ? res.body : JSON.stringify(res.body) }
}

async function listTree(token: string, repo: RepoRef, path: string, ref: string, opts?: { recursive?: boolean }): Promise<ListTreeResult> {
  const recursive = opts?.recursive === true
  const entries: TreeEntry[] = []
  let page: string | null = '1'
  while (page) {
    const qp = new URLSearchParams({ path, ref, recursive: String(recursive), per_page: '100', page })
    const res = await fetch(`${API}/projects/${projectId(repo)}/repository/tree?${qp.toString()}`, { headers: headers(token) })
    const contentType = res.headers.get('content-type') ?? ''
    const body = contentType.includes('application/json') ? await res.json().catch(() => ({})) : await res.text()
    if (!res.ok) return { ok: false, error: typeof body === 'string' ? body : (body?.message ?? `GitLab list tree failed (${res.status})`) }
    const items: any[] = Array.isArray(body) ? body : []
    for (const item of items) {
      if (!item?.path || isExcludedPath(item.path)) continue
      entries.push({ path: item.path, type: item.type === 'tree' ? 'dir' : 'file' })
      if (entries.length >= MAX_TREE_ENTRIES) break
    }
    if (entries.length >= MAX_TREE_ENTRIES) break
    page = res.headers.get('x-next-page') || null
  }
  return { ok: true, entries }
}

async function createBranch(token: string, repo: RepoRef, fromRef: string, newBranch: string): Promise<TestResult> {
  const res = await glFetch(`/projects/${projectId(repo)}/repository/branches?branch=${encodeURIComponent(newBranch)}&ref=${encodeURIComponent(fromRef)}`, token, { method: 'POST' })
  if (!res.ok) return { ok: false, error: res.body?.message ?? `GitLab create branch failed (${res.status})` }
  return { ok: true }
}

async function commitFiles(token: string, repo: RepoRef, branch: string, files: RepoFile[], message: string): Promise<TestResult> {
  // Atomic multi-file commit via the actions[] array — genuinely simpler/
  // safer than GitHub here, no partial-commit failure mode possible.
  const actions = files.map((f) => ({ action: 'update', file_path: f.path, content: f.newContent }))
  const res = await glFetch(`/projects/${projectId(repo)}/repository/commits`, token, {
    method: 'POST',
    body: JSON.stringify({ branch, commit_message: message, actions }),
  })
  if (!res.ok) return { ok: false, error: res.body?.message ?? `GitLab commit failed (${res.status})` }
  return { ok: true }
}

async function openPR(token: string, repo: RepoRef, branch: string, baseBranch: string, title: string, body: string): Promise<OpenPrResult> {
  const res = await glFetch(`/projects/${projectId(repo)}/merge_requests`, token, {
    method: 'POST',
    body: JSON.stringify({ source_branch: branch, target_branch: baseBranch, title, description: body }),
  })
  if (!res.ok) return { ok: false, error: res.body?.message ?? `GitLab open MR failed (${res.status})` }
  return { ok: true, prUrl: res.body.web_url, prNumber: res.body.iid }
}

async function getPRStatus(token: string, repo: RepoRef, prNumber: number): Promise<PrStatusResult> {
  const res = await glFetch(`/projects/${projectId(repo)}/merge_requests/${prNumber}`, token)
  if (!res.ok) return { ok: false, error: res.body?.message ?? `GitLab get MR failed (${res.status})` }
  const state: 'open' | 'merged' | 'closed' = res.body.state === 'merged' ? 'merged' : res.body.state === 'closed' ? 'closed' : 'open'

  // Real pipeline status off the MR's head_pipeline — no extra call needed.
  // NOTE: never exercised against a live GitLab instance (see file header) —
  // if head_pipeline comes back missing for this token scope/tier, fall
  // back to GET /projects/:id/repository/commits/:sha/statuses using
  // res.body.sha (the MR diff head).
  const pipelineStatus: string | undefined = res.body.head_pipeline?.status
  let checksPassed: boolean | null = null
  let checksPending = false
  if (pipelineStatus === 'success') checksPassed = true
  else if (pipelineStatus === 'failed' || pipelineStatus === 'canceled') checksPassed = false
  else if (pipelineStatus === 'running' || pipelineStatus === 'pending' || pipelineStatus === 'created') checksPending = true
  // else: no head_pipeline at all -> checksPassed stays null, checksPending stays false (no CI configured)

  return {
    ok: true,
    state,
    mergeable: res.body.merge_status === 'can_be_merged',
    checksPassed,
    checksPending,
    checksSupported: true,
  }
}

async function mergePR(token: string, repo: RepoRef, prNumber: number): Promise<TestResult> {
  const res = await glFetch(`/projects/${projectId(repo)}/merge_requests/${prNumber}/merge`, token, { method: 'PUT' })
  if (!res.ok) return { ok: false, error: res.body?.message ?? `GitLab merge failed (${res.status})` }
  return { ok: true }
}

export const gitlabAdapter: GitAdapter = {
  verifyToken, listRepos, getFileContent, listTree, createBranch, commitFiles, openPR, getPRStatus, mergePR,
}
