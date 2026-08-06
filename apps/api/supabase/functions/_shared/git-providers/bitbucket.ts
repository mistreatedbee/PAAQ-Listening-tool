// Implemented against the documented Bitbucket Cloud REST API contract.
// Never exercised against a live Bitbucket workspace in this environment —
// treat as beta/unverified until smoke-tested with real credentials.
import type {
  GitAdapter, RepoRef, RepoFile, TestResult, ListReposResult, GetFileResult, OpenPrResult, PrStatusResult, TreeEntry, ListTreeResult,
  MergePrResult, CreateWebhookResult,
} from './types.ts'

const API = 'https://api.bitbucket.org/2.0'

const EXCLUDED_SEGMENTS = ['node_modules', '.git', 'dist', 'build', 'vendor', '.next', '.turbo', 'coverage']
const MAX_TREE_ENTRIES = 2000

function isExcludedPath(path: string): boolean {
  const segments = path.split('/')
  return EXCLUDED_SEGMENTS.some((seg) => segments.includes(seg))
}

function headers(token: string) {
  return { Authorization: `Bearer ${token}` }
}

async function bbFetch(path: string, token: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers(token), ...(init.headers ?? {}) } })
  const contentType = res.headers.get('content-type') ?? ''
  const body = contentType.includes('json') ? await res.json().catch(() => ({})) : await res.text()
  return { ok: res.ok, status: res.status, body }
}

async function verifyToken(token: string): Promise<TestResult> {
  const res = await bbFetch('/user', token)
  if (res.ok) return { ok: true }
  return { ok: false, error: res.body?.error?.message ?? `Bitbucket auth check failed (${res.status})` }
}

async function listRepos(token: string): Promise<ListReposResult> {
  const workspacesRes = await bbFetch('/workspaces?pagelen=50', token)
  if (!workspacesRes.ok) return { ok: false, error: workspacesRes.body?.error?.message ?? `Bitbucket list workspaces failed (${workspacesRes.status})` }

  const repos: RepoRef[] = []
  for (const ws of (workspacesRes.body?.values ?? [])) {
    const reposRes = await bbFetch(`/repositories/${ws.slug}?pagelen=100`, token)
    if (!reposRes.ok) continue
    for (const r of (reposRes.body?.values ?? [])) {
      repos.push({
        fullName: r.full_name,
        url: r.links?.html?.href,
        defaultBranch: r.mainbranch?.name ?? 'main',
        private: r.is_private,
      })
    }
  }
  return { ok: true, repos }
}

async function getFileContent(token: string, repo: RepoRef, path: string, ref: string): Promise<GetFileResult> {
  const res = await bbFetch(`/repositories/${repo.fullName}/src/${encodeURIComponent(ref)}/${path}`, token)
  if (!res.ok) return { ok: false, error: typeof res.body === 'string' ? res.body : `Bitbucket get file failed (${res.status})` }
  return { ok: true, content: typeof res.body === 'string' ? res.body : JSON.stringify(res.body) }
}

async function listTree(token: string, repo: RepoRef, path: string, ref: string, opts?: { recursive?: boolean }): Promise<ListTreeResult> {
  const recursive = opts?.recursive === true
  const entries: TreeEntry[] = []
  const queue: string[] = [path ?? '']
  while (queue.length > 0 && entries.length < MAX_TREE_ENTRIES) {
    const currentPath = queue.shift() as string
    let nextUrl: string | null = `${API}/repositories/${repo.fullName}/src/${encodeURIComponent(ref)}/${currentPath}`
    while (nextUrl && entries.length < MAX_TREE_ENTRIES) {
      const res = await fetch(nextUrl, { headers: headers(token) })
      const contentType = res.headers.get('content-type') ?? ''
      const body: any = contentType.includes('json') ? await res.json().catch(() => ({})) : await res.text()
      if (!res.ok) return { ok: false, error: typeof body === 'string' ? body : (body?.error?.message ?? `Bitbucket list tree failed (${res.status})`) }
      const items: any[] = Array.isArray(body?.values) ? body.values : []
      for (const item of items) {
        if (!item?.path || isExcludedPath(item.path)) continue
        const type: 'file' | 'dir' = item.type === 'commit_directory' ? 'dir' : 'file'
        entries.push({ path: item.path, type, size: item.size })
        if (type === 'dir' && recursive) queue.push(item.path)
        if (entries.length >= MAX_TREE_ENTRIES) break
      }
      nextUrl = body?.next ?? null
    }
  }
  return { ok: true, entries }
}

async function createBranch(token: string, repo: RepoRef, fromRef: string, newBranch: string): Promise<TestResult> {
  const res = await bbFetch(`/repositories/${repo.fullName}/refs/branches`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newBranch, target: { hash: fromRef } }),
  })
  if (!res.ok) return { ok: false, error: res.body?.error?.message ?? `Bitbucket create branch failed (${res.status})` }
  return { ok: true }
}

async function commitFiles(token: string, repo: RepoRef, branch: string, files: RepoFile[], message: string): Promise<TestResult> {
  // Bitbucket's src endpoint takes one multipart form per commit but can
  // include multiple files in a single form post — closer to atomic than
  // GitHub's per-file loop, though still one call per commit here.
  const form = new FormData()
  form.append('message', message)
  form.append('branch', branch)
  for (const f of files) form.append(f.path, f.newContent)
  const res = await fetch(`${API}/repositories/${repo.fullName}/src`, {
    method: 'POST',
    headers: headers(token),
    body: form,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { ok: false, error: body?.error?.message ?? `Bitbucket commit failed (${res.status})` }
  }
  return { ok: true }
}

async function openPR(token: string, repo: RepoRef, branch: string, baseBranch: string, title: string, body: string): Promise<OpenPrResult> {
  const res = await bbFetch(`/repositories/${repo.fullName}/pullrequests`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      description: body,
      source: { branch: { name: branch } },
      destination: { branch: { name: baseBranch } },
    }),
  })
  if (!res.ok) return { ok: false, error: res.body?.error?.message ?? `Bitbucket open PR failed (${res.status})` }
  return { ok: true, prUrl: res.body.links?.html?.href, prNumber: res.body.id }
}

async function getPRStatus(token: string, repo: RepoRef, prNumber: number): Promise<PrStatusResult> {
  const res = await bbFetch(`/repositories/${repo.fullName}/pullrequests/${prNumber}`, token)
  if (!res.ok) return { ok: false, error: res.body?.error?.message ?? `Bitbucket get PR failed (${res.status})` }
  const state: 'open' | 'merged' | 'closed' = res.body.state === 'MERGED' ? 'merged' : res.body.state === 'DECLINED' ? 'closed' : 'open'
  // No wired check-status implementation for this provider — explicit
  // checksSupported:false so the UI distinguishes "unsupported" from
  // "queried and inconclusive" (see GitHub/GitLab).
  return { ok: true, state, mergeable: null, checksPassed: null, checksSupported: false }
}

async function mergePR(token: string, repo: RepoRef, prNumber: number): Promise<MergePrResult> {
  const res = await bbFetch(`/repositories/${repo.fullName}/pullrequests/${prNumber}/merge`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ merge_strategy: 'squash' }),
  })
  if (!res.ok) return { ok: false, error: res.body?.error?.message ?? `Bitbucket merge failed (${res.status})` }
  return { ok: true, commitSha: res.body.merge_commit?.hash ?? null }
}

async function createWebhook(token: string, repo: RepoRef, callbackUrl: string): Promise<CreateWebhookResult> {
  const res = await bbFetch(`/repositories/${repo.fullName}/hooks`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'PAAQ Deployment Tracking',
      url: callbackUrl,
      active: true,
      events: ['repo:push'],
    }),
  })
  if (!res.ok) return { ok: false, error: res.body?.error?.message ?? `Bitbucket webhook creation failed (${res.status})` }
  return { ok: true, webhookId: res.body.uuid }
}

async function deleteWebhook(token: string, repo: RepoRef, webhookId: string): Promise<TestResult> {
  const res = await bbFetch(`/repositories/${repo.fullName}/hooks/${webhookId}`, token, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) return { ok: false, error: res.body?.error?.message ?? `Bitbucket webhook deletion failed (${res.status})` }
  return { ok: true }
}

export const bitbucketAdapter: GitAdapter = {
  verifyToken, listRepos, getFileContent, listTree, createBranch, commitFiles, openPR, getPRStatus, mergePR, createWebhook, deleteWebhook,
}
