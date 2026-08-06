export type RepoRef = { fullName: string; url: string; defaultBranch: string; private: boolean; id?: string | number }
export type RepoFile = { path: string; newContent: string }

export type TestResult = { ok: true } | { ok: false; error: string }
export type ListReposResult = { ok: true; repos: RepoRef[] } | { ok: false; error: string }
export type GetFileResult = { ok: true; content: string; sha?: string } | { ok: false; error: string }
export type TreeEntry = { path: string; type: 'file' | 'dir'; size?: number }
export type ListTreeResult = { ok: true; entries: TreeEntry[] } | { ok: false; error: string }
export type OpenPrResult = { ok: true; prUrl: string; prNumber: number } | { ok: false; error: string }
export type PrStatusResult =
  | {
      ok: true
      state: 'open' | 'merged' | 'closed'
      mergeable: boolean | null
      /** true = all checks green; false = a real failure; null = no CI configured, or still running (see checksPending). */
      checksPassed: boolean | null
      /** true while checks are still running — null checksPassed + pending=true means "wait," not "no CI." */
      checksPending?: boolean
      /** false for providers with no wired check-status implementation (azure/bitbucket) — distinct from "queried and inconclusive." */
      checksSupported: boolean
    }
  | { ok: false; error: string }

export interface GitAdapter {
  /** Cheap identity call used to verify a token before it's ever persisted. */
  verifyToken(token: string): Promise<TestResult>
  listRepos(token: string): Promise<ListReposResult>
  getFileContent(token: string, repo: RepoRef, path: string, ref: string): Promise<GetFileResult>
  /** Non-recursive-by-default directory listing; recursive:true for a full tree. */
  listTree(token: string, repo: RepoRef, path: string, ref: string, opts?: { recursive?: boolean }): Promise<ListTreeResult>
  createBranch(token: string, repo: RepoRef, fromRef: string, newBranch: string): Promise<TestResult>
  /** One atomic call where the provider supports it (GitLab/Azure); sequential per-file elsewhere (GitHub/Bitbucket). */
  commitFiles(token: string, repo: RepoRef, branch: string, files: RepoFile[], message: string): Promise<TestResult>
  openPR(token: string, repo: RepoRef, branch: string, baseBranch: string, title: string, body: string): Promise<OpenPrResult>
  getPRStatus(token: string, repo: RepoRef, prNumber: number): Promise<PrStatusResult>
  /** A rejection here (branch protection, missing reviews, failing checks) is a correct, expected outcome — never bypassed. */
  mergePR(token: string, repo: RepoRef, prNumber: number): Promise<TestResult>
}

export type GitErrorCategory = 'invalid_auth' | 'not_found' | 'blocked_by_protection' | 'rate_limited' | 'unknown'

export function categorizeGitError(status: number, message: string): GitErrorCategory {
  const m = message.toLowerCase()
  if (status === 401 || status === 403) {
    if (m.includes('review') || m.includes('protect') || m.includes('required status check')) return 'blocked_by_protection'
    return 'invalid_auth'
  }
  if (status === 404) return 'not_found'
  if (status === 405 || status === 406 || status === 409) return 'blocked_by_protection'
  if (status === 429) return 'rate_limited'
  return 'unknown'
}
