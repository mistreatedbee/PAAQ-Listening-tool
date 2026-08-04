// Implemented against the documented Azure DevOps REST API contract.
// Never exercised against a live Azure DevOps org in this environment —
// treat as beta/unverified until smoke-tested with real credentials.
//
// RepoRef.fullName convention for this provider: "{org}/{project}/{repo}"
// (Azure repos are always scoped to an org+project, unlike the other 3).
import type {
  GitAdapter, RepoRef, RepoFile, TestResult, ListReposResult, GetFileResult, OpenPrResult, PrStatusResult,
} from './types.ts'

const API_VERSION = '7.1'

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

function parts(repo: RepoRef): { org: string; project: string; repo: string } {
  const [org, project, repoName] = repo.fullName.split('/')
  return { org, project, repo: repoName }
}

async function azFetch(url: string, token: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(url, { ...init, headers: { ...headers(token), ...(init.headers ?? {}) } })
  const contentType = res.headers.get('content-type') ?? ''
  const body = contentType.includes('json') ? await res.json().catch(() => ({})) : await res.text()
  return { ok: res.ok, status: res.status, body }
}

async function verifyToken(token: string): Promise<TestResult> {
  const res = await azFetch(`https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=${API_VERSION}`, token)
  if (res.ok) return { ok: true }
  return { ok: false, error: res.body?.message ?? `Azure auth check failed (${res.status})` }
}

async function listRepos(token: string): Promise<ListReposResult> {
  const accountsRes = await azFetch(`https://app.vssps.visualstudio.com/_apis/accounts?api-version=${API_VERSION}`, token)
  if (!accountsRes.ok) return { ok: false, error: accountsRes.body?.message ?? `Azure list orgs failed (${accountsRes.status})` }

  const repos: RepoRef[] = []
  for (const account of (accountsRes.body?.value ?? [])) {
    const org = account.accountName
    const projectsRes = await azFetch(`https://dev.azure.com/${org}/_apis/projects?api-version=${API_VERSION}`, token)
    if (!projectsRes.ok) continue
    for (const project of (projectsRes.body?.value ?? [])) {
      const reposRes = await azFetch(`https://dev.azure.com/${org}/${project.name}/_apis/git/repositories?api-version=${API_VERSION}`, token)
      if (!reposRes.ok) continue
      for (const r of (reposRes.body?.value ?? [])) {
        repos.push({
          id: r.id,
          fullName: `${org}/${project.name}/${r.name}`,
          url: r.webUrl,
          defaultBranch: (r.defaultBranch ?? 'refs/heads/main').replace('refs/heads/', ''),
          private: true,
        })
      }
    }
  }
  return { ok: true, repos }
}

async function getFileContent(token: string, repo: RepoRef, path: string, ref: string): Promise<GetFileResult> {
  const { org, project, repo: repoName } = parts(repo)
  const url = `https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repoName}/items?path=${encodeURIComponent(path)}&versionDescriptor.version=${encodeURIComponent(ref)}&$format=text&api-version=${API_VERSION}`
  const res = await azFetch(url, token)
  if (!res.ok) return { ok: false, error: typeof res.body === 'string' ? res.body : `Azure get file failed (${res.status})` }
  return { ok: true, content: typeof res.body === 'string' ? res.body : JSON.stringify(res.body) }
}

async function createBranch(token: string, repo: RepoRef, fromRef: string, newBranch: string): Promise<TestResult> {
  const { org, project, repo: repoName } = parts(repo)
  const refsRes = await azFetch(`https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repoName}/refs?filter=heads/${encodeURIComponent(fromRef)}&api-version=${API_VERSION}`, token)
  if (!refsRes.ok || !refsRes.body?.value?.[0]) return { ok: false, error: refsRes.body?.message ?? `Azure get ref failed (${refsRes.status})` }
  const baseSha = refsRes.body.value[0].objectId
  const res = await azFetch(`https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repoName}/refs?api-version=${API_VERSION}`, token, {
    method: 'POST',
    body: JSON.stringify([{ name: `refs/heads/${newBranch}`, oldObjectId: '0000000000000000000000000000000000000000', newObjectId: baseSha }]),
  })
  if (!res.ok) return { ok: false, error: res.body?.message ?? `Azure create branch failed (${res.status})` }
  return { ok: true }
}

async function commitFiles(token: string, repo: RepoRef, branch: string, files: RepoFile[], message: string): Promise<TestResult> {
  const { org, project, repo: repoName } = parts(repo)
  const refsRes = await azFetch(`https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repoName}/refs?filter=heads/${encodeURIComponent(branch)}&api-version=${API_VERSION}`, token)
  if (!refsRes.ok || !refsRes.body?.value?.[0]) return { ok: false, error: refsRes.body?.message ?? `Azure get branch ref failed (${refsRes.status})` }
  const oldObjectId = refsRes.body.value[0].objectId

  // Atomic push — a single call with all file changes, like GitLab's commits API.
  const res = await azFetch(`https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repoName}/pushes?api-version=${API_VERSION}`, token, {
    method: 'POST',
    body: JSON.stringify({
      refUpdates: [{ name: `refs/heads/${branch}`, oldObjectId }],
      commits: [{
        comment: message,
        changes: files.map((f) => ({
          changeType: 'edit',
          item: { path: `/${f.path}` },
          newContent: { content: f.newContent, contentType: 'rawtext' },
        })),
      }],
    }),
  })
  if (!res.ok) return { ok: false, error: res.body?.message ?? `Azure push failed (${res.status})` }
  return { ok: true }
}

async function openPR(token: string, repo: RepoRef, branch: string, baseBranch: string, title: string, body: string): Promise<OpenPrResult> {
  const { org, project, repo: repoName } = parts(repo)
  const res = await azFetch(`https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repoName}/pullrequests?api-version=${API_VERSION}`, token, {
    method: 'POST',
    body: JSON.stringify({
      sourceRefName: `refs/heads/${branch}`,
      targetRefName: `refs/heads/${baseBranch}`,
      title,
      description: body,
    }),
  })
  if (!res.ok) return { ok: false, error: res.body?.message ?? `Azure open PR failed (${res.status})` }
  return { ok: true, prUrl: `https://dev.azure.com/${org}/${project}/_git/${repoName}/pullrequest/${res.body.pullRequestId}`, prNumber: res.body.pullRequestId }
}

async function getPRStatus(token: string, repo: RepoRef, prNumber: number): Promise<PrStatusResult> {
  const { org, project, repo: repoName } = parts(repo)
  const res = await azFetch(`https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repoName}/pullrequests/${prNumber}?api-version=${API_VERSION}`, token)
  if (!res.ok) return { ok: false, error: res.body?.message ?? `Azure get PR failed (${res.status})` }
  const status = res.body.status
  const state: 'open' | 'merged' | 'closed' = status === 'completed' ? 'merged' : status === 'abandoned' ? 'closed' : 'open'
  // No wired check-status implementation for this provider — explicit
  // checksSupported:false so the UI distinguishes "unsupported" from
  // "queried and inconclusive" (see GitHub/GitLab).
  return { ok: true, state, mergeable: res.body.mergeStatus === 'succeeded', checksPassed: null, checksSupported: false }
}

async function mergePR(token: string, repo: RepoRef, prNumber: number): Promise<TestResult> {
  const { org, project, repo: repoName } = parts(repo)
  const prRes = await azFetch(`https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repoName}/pullrequests/${prNumber}?api-version=${API_VERSION}`, token)
  if (!prRes.ok) return { ok: false, error: prRes.body?.message ?? `Azure get PR failed (${prRes.status})` }
  const res = await azFetch(`https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repoName}/pullrequests/${prNumber}?api-version=${API_VERSION}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed', lastMergeSourceCommit: prRes.body.lastMergeSourceCommit }),
  })
  if (!res.ok) return { ok: false, error: res.body?.message ?? `Azure merge failed (${res.status})` }
  return { ok: true }
}

export const azureAdapter: GitAdapter = {
  verifyToken, listRepos, getFileContent, createBranch, commitFiles, openPR, getPRStatus, mergePR,
}
