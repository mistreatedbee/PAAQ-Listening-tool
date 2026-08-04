/**
 * Sweeps for low-risk AI fixes with a real green CI check on a project set
 * to Autonomous approval mode, and merges them without a human click —
 * using exactly the same merge logic (performMerge) the human-triggered
 * path in execute-fix uses, not a separate copy.
 *
 * Structurally can never touch medium/high risk (excluded by the query
 * itself) and never merges on an unresolved/unsupported CI status (only an
 * exact checksPassed===true triggers a merge; unlike the dashboard's
 * human-acknowledgment escape hatch, this cron never sets
 * allowUnknownChecks).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withRetryResult } from '../_shared/retry.ts'
import { loadGitAdapter } from '../_shared/git-providers/load-adapter.ts'
import { getRepoAndToken, performMerge, type RecRow } from '../_shared/fix-engine.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function checkInternalSecret(req: Request): boolean {
  const provided = req.headers.get('x-internal-secret') ?? ''
  const expected = Deno.env.get('REPO_CONNECTOR_INTERNAL_SECRET') ?? ''
  return expected.length > 0 && provided === expected
}

async function runSweep() {
  const { data: rows, error } = await withRetryResult(() =>
    supabase.from('recommendations')
      .select('*')
      .eq('fix_pr_state', 'open')
      .eq('risk_level', 'low'),
  )

  if (error || !rows) {
    console.error('autonomous-merge-cron: failed to load candidate recommendations', error)
    return
  }

  for (const rec of rows as RecRow[]) {
    try {
      const { data: proj } = await supabase
        .from('tenant_projects')
        .select('approval_mode')
        .eq('id', rec.project_id)
        .maybeSingle()
      if (proj?.approval_mode !== 'autonomous') continue

      const repoResult = await getRepoAndToken(rec.project_id)
      if (!repoResult.ok) continue
      const { provider, repo, token } = repoResult
      const adapter = await loadGitAdapter(provider)

      const status = await adapter.getPRStatus(token, repo, rec.fix_pr_number!)
      if (!status.ok || status.checksPassed !== true) continue // only an exact true ever triggers an autonomous merge

      const result = await performMerge(rec, { allowUnknownChecks: false, actingUserId: null })
      if (!result.ok) {
        console.error(`autonomous-merge-cron: merge failed for recommendation ${rec.id}`, result.error)
      } else {
        console.log(`autonomous-merge-cron: merged recommendation ${rec.id}`)
      }
    } catch (err) {
      console.error(`autonomous-merge-cron: sweep error for recommendation ${rec.id}`, err)
    }
  }
}

// Every 10 minutes — tighter than the general-purpose 15-min sweeps
// elsewhere, since this gates real production merges and staleness matters.
Deno.cron('autonomous-merge-sweep', '*/10 * * * *', runSweep)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  if (!checkInternalSecret(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...cors() },
    })
  }
  await runSweep()
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...cors() },
  })
})

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
