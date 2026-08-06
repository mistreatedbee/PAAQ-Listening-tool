/**
 * Shared core of the AI fix pipeline — repo/token resolution and the merge
 * flow, factored out of execute-fix/index.ts so both the HTTP action
 * dispatcher (execute-fix) and the scheduled sweep (autonomous-merge-cron)
 * call exactly the same logic instead of two copies drifting apart.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { loadGitAdapter, type GitProvider } from './git-providers/load-adapter.ts'
import { categorizeGitError, type RepoRef } from './git-providers/types.ts'
import { decryptSecret } from './crypto.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const KEY_ENV = 'REPO_CONNECTOR_ENCRYPTION_KEY'

export type AffectedFile = { path: string; function?: string; reason?: string }

export type RecRow = {
  id: string
  project_id: string
  title: string
  description: string | null
  type: string
  root_cause: string | null
  affected_files: AffectedFile[] | null
  patch_plan: string[] | null
  fix_changeset: { path: string; newContent: string }[] | null
  fix_branch: string | null
  fix_pr_url: string | null
  fix_pr_number: number | null
  fix_pr_state: string
  risk_level: string | null
}

export type ApprovalMode = 'advisory' | 'assisted' | 'team' | 'autonomous'

export async function getApprovalMode(projectId: string): Promise<ApprovalMode> {
  const { data } = await supabase.from('tenant_projects').select('approval_mode').eq('id', projectId).maybeSingle()
  const mode = data?.approval_mode as ApprovalMode | undefined
  return mode ?? 'team'
}

export async function getRepoAndToken(projectId: string): Promise<
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

export async function markFailed(recId: string, error: string) {
  await supabase.from('recommendations').update({ fix_pr_state: 'failed', fix_error: error }).eq('id', recId)
}

export type MergeResult =
  | { ok: true; merged: true }
  | { ok: true; alreadyMerged: true }
  | { ok: false; error: string; blockedByProtection?: boolean; blockedByChecks?: boolean; unknownChecks?: boolean }

/**
 * The real merge flow: re-fetches live PR status (never trusts cached
 * fix_pr_state), hard-blocks on a failing CI check regardless of caller,
 * and only proceeds on an unresolved/unsupported check status if the
 * caller explicitly set allowUnknownChecks (a human acknowledgment in the
 * dashboard — autonomous-merge-cron never sets this, it only ever merges
 * on an exact checksPassed===true).
 */
export async function performMerge(
  rec: RecRow,
  opts: { allowUnknownChecks: boolean; actingUserId: string | null },
): Promise<MergeResult> {
  if (!rec.fix_pr_number) return { ok: false, error: 'No open PR to merge' }

  const repoResult = await getRepoAndToken(rec.project_id)
  if (!repoResult.ok) return { ok: false, error: repoResult.error }
  const { provider, repo, token } = repoResult
  const adapter = await loadGitAdapter(provider)

  const status = await adapter.getPRStatus(token, repo, rec.fix_pr_number)
  if (!status.ok) return { ok: false, error: status.error }

  if (status.state === 'merged') {
    await supabase.from('recommendations').update({ fix_pr_state: 'merged' }).eq('id', rec.id)
    return { ok: true, alreadyMerged: true }
  }
  if (status.state === 'closed') {
    await supabase.from('recommendations').update({ fix_pr_state: 'closed' }).eq('id', rec.id)
    return { ok: false, error: 'PR was closed without merging' }
  }

  if (status.checksPassed === false) {
    await markFailed(rec.id, 'Blocked: CI checks are failing on this PR')
    return { ok: false, error: 'Blocked: CI checks are failing on this PR', blockedByChecks: true }
  }
  if (status.checksPassed === null && !opts.allowUnknownChecks) {
    return {
      ok: false,
      error: status.checksSupported
        ? 'No CI checks configured on this repo — acknowledge to merge without automated verification'
        : 'CI status is unavailable for this provider — acknowledge to merge without automated verification',
      unknownChecks: true,
    }
  }

  const mergeResult = await adapter.mergePR(token, repo, rec.fix_pr_number)
  if (!mergeResult.ok) {
    const category = categorizeGitError(400, mergeResult.error)
    await markFailed(rec.id, mergeResult.error)
    return { ok: false, blockedByProtection: category === 'blocked_by_protection', error: mergeResult.error }
  }

  await recordMerge(rec, { actingUserId: opts.actingUserId })
  return { ok: true, merged: true }
}

/**
 * Marks a recommendation as merged and writes its deployment_registry row —
 * the completion step both a PAAQ-initiated merge (performMerge, above) and
 * a merge PAAQ only *detects* after the fact need to run. Without this,
 * a PR merged manually on GitHub (rather than through PAAQ's merge button)
 * only ever gets fix_pr_state flipped to 'merged' by the status-poll in
 * execute-fix's handleStatus — recommendations.status stays 'pending'
 * forever and Deployment Intelligence never learns the change shipped,
 * even though it demonstrably did (confirmed against real PR status).
 * actingUserId is left null for a detected-not-performed merge — never
 * attribute an approval to nobody actually gave through PAAQ.
 */
export async function recordMerge(rec: RecRow, opts: { actingUserId: string | null }): Promise<void> {
  const now = new Date().toISOString()
  await supabase.from('recommendations').update({
    status: 'approved',
    approved_by: opts.actingUserId,
    approved_at: now,
    fix_pr_state: 'merged',
    fix_merged_at: now,
    fix_error: null,
  }).eq('id', rec.id)

  // Write to deployment_registry so Deployment Intelligence shows this fix.
  const branch = rec.fix_branch ?? `paaq-fix-${rec.id.slice(0, 8)}`
  const changedFiles = (rec.fix_changeset ?? []).map((c) => ({ path: c.path }))
  try {
    // tenant_id is NOT NULL on this table with no default — every prior
    // insert here omitted it and failed silently under this same catch,
    // which is the real reason Deployment Intelligence has been missing
    // nearly every AI-fix merge (confirmed: 11 recommendations merged,
    // only 2 pre-existing deployment_registry rows, neither from a fix).
    const { data: project } = await supabase
      .from('tenant_projects')
      .select('tenant_id')
      .eq('id', rec.project_id)
      .maybeSingle()
    if (!project) throw new Error('project not found for tenant_id lookup')

    await supabase.from('deployment_registry').insert({
      tenant_id: project.tenant_id,
      project_id: rec.project_id,
      version: branch,
      environment: 'production',
      deployed_at: now,
      deployed_by: opts.actingUserId ? `user:${opts.actingUserId}` : 'PAAQ AI',
      status: 'success',
      git_commit: branch,
      release_notes: `AI Fix: ${rec.title}`,
      changed_features: changedFiles.map((f) => f.path),
      ai_fix: true,
      recommendation_id: rec.id,
      pr_url: rec.fix_pr_url,
      pr_number: rec.fix_pr_number,
      ai_summary: rec.description,
      changed_files: changedFiles,
    })
  } catch { /* non-fatal — don't fail the caller's response */ }
}
