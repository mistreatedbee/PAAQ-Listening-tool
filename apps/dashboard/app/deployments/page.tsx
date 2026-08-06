'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import {
  Rocket, GitCommit, Tag, Radio, Sparkles, GitPullRequest,
  FileCode2, ExternalLink, GitMerge, Globe, Copy, Check,
  ChevronDown, ChevronUp, AlertTriangle, Loader2, GitBranch,
  Clock, ShieldCheck, ShieldAlert, Undo2, Search, Fingerprint,
} from 'lucide-react'
import { PageHeader, Card, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/data'

type DbDeployment = {
  id: string
  version: string
  environment: string
  deployed_at: string
  deployed_by: string | null
  release_notes: string | null
  status: string
  git_commit: string | null
  git_tag: string | null
  changed_features: string[] | null
  ai_fix: boolean | null
  recommendation_id: string | null
  pr_url: string | null
  pr_number: number | null
  ai_summary: string | null
  ai_confidence: number | null
  changed_files: { path: string }[] | null
  source: string | null
  build_log: string | null
  ai_diagnosis: string | null
  branch: string | null
  commit_sha: string | null
  duration_ms: number | null
  validation_passed: boolean | null
  validation_results: { checksPassed: boolean | null; checksPending: boolean; checksSupported: boolean } | null
  rollback_of_id: string | null
  rolled_back_at: string | null
  investigation_id: string | null
}

type RepoInfo = { provider: string; repo_name: string; repo_url: string | null }

const SOURCE_LABELS: Record<string, string> = {
  'vercel': 'Vercel', 'github-actions': 'GitHub Actions', 'netlify': 'Netlify',
  'docker': 'Docker', 'manual': 'Manual', 'paaq-ai': 'PAAQ AI', 'generic': 'Webhook',
  'github-push': 'GitHub', 'gitlab-push': 'GitLab', 'azure-push': 'Azure DevOps', 'bitbucket-push': 'Bitbucket',
}

function SourceBadge({ source }: { source: string | null }) {
  const label = source ? (SOURCE_LABELS[source] ?? source) : 'Manual'
  return (
    <span className="rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {label}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/50 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-healthy" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

type EnvFilter = 'all' | 'production' | 'staging' | 'development'

function statusTone(s: string): Tone {
  if (s === 'success') return 'healthy'
  if (s === 'failed') return 'critical'
  if (s === 'rolled-back') return 'warning'
  return 'intel'
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function fmtDuration(ms: number | null) {
  if (ms == null || ms < 0) return null
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

const ENV_FILTERS: { id: EnvFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'production', label: 'Production' },
  { id: 'staging', label: 'Staging' },
  { id: 'development', label: 'Development' },
]

// ── Field grid — every traceability field, shared by AI-fix and manual rows
function DetailField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  if (value == null || value === '') return null
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</p>
      <div className={cn('mt-0.5 truncate text-xs text-foreground', mono && 'font-mono')}>{value}</div>
    </div>
  )
}

function ValidationBadge({ d }: { d: DbDeployment }) {
  if (d.validation_results == null) return <span className="text-xs text-muted-foreground">No validation data</span>
  const { checksPassed, checksPending, checksSupported } = d.validation_results
  if (checksPending) return <span className="flex items-center gap-1 text-xs text-warning"><Loader2 className="h-3 w-3 animate-spin" /> Checks running</span>
  if (checksPassed === true) return <span className="flex items-center gap-1 text-xs text-healthy"><ShieldCheck className="h-3 w-3" /> All checks passed</span>
  if (checksPassed === false) return <span className="flex items-center gap-1 text-xs text-critical"><ShieldAlert className="h-3 w-3" /> Checks failed</span>
  return <span className="text-xs text-muted-foreground">{checksSupported ? 'No CI configured' : 'Check status unavailable for this provider'}</span>
}

function DeploymentDetails({ d, repo }: { d: DbDeployment; repo?: RepoInfo }) {
  const duration = fmtDuration(d.duration_ms)
  return (
    <div className="border-t border-border/50 bg-background/20 px-5 py-4 space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        <DetailField label="Deployment ID" value={d.id} mono />
        <DetailField label="Version" value={d.version} mono />
        <DetailField label="Branch" value={d.branch ? <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" />{d.branch}</span> : null} />
        <DetailField label="Commit Hash" value={d.commit_sha ?? d.git_commit} mono />
        <DetailField label="Repository" value={repo ? <a href={repo.repo_url ?? '#'} target="_blank" rel="noreferrer" className="text-intel hover:underline">{repo.repo_name}</a> : null} />
        <DetailField label="Environment" value={d.environment} />
        <DetailField label="Deployment Time" value={fmt(d.deployed_at)} />
        <DetailField label="Duration" value={duration ? <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{duration}</span> : null} />
        <DetailField label="Status" value={<ToneBadge tone={statusTone(d.status)}>{d.status}</ToneBadge>} />
        <DetailField label="Triggered By" value={d.deployed_by} />
        <DetailField label="Rollback Status" value={
          d.rollback_of_id ? <span className="flex items-center gap-1 text-warning"><Undo2 className="h-3 w-3" /> Rollback of another deployment</span>
          : d.rolled_back_at ? <span className="flex items-center gap-1 text-critical"><Undo2 className="h-3 w-3" /> Rolled back {fmt(d.rolled_back_at)}</span>
          : null
        } />
        <DetailField label="Related Recommendation" value={d.recommendation_id ? <a href={`/recommendations?id=${d.recommendation_id}`} className="text-intel hover:underline">View recommendation</a> : null} />
        <DetailField label="Related Investigation" value={d.investigation_id ? <a href={`/incidents?investigation=${d.investigation_id}`} className="flex items-center gap-1 text-intel hover:underline"><Search className="h-3 w-3" />View investigation</a> : null} />
        <DetailField label="Pull Request" value={d.pr_url ? <a href={d.pr_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-intel hover:underline"><GitPullRequest className="h-3 w-3" />{d.pr_number ? `#${d.pr_number}` : 'View PR'}</a> : null} />
      </div>

      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Validation Results</p>
        <ValidationBadge d={d} />
      </div>

      {d.ai_summary && (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">AI Summary</p>
          <p className="text-xs text-foreground leading-relaxed">{d.ai_summary}</p>
        </div>
      )}

      {d.changed_files && d.changed_files.length > 0 && (
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 flex items-center gap-1">
            <FileCode2 className="h-3 w-3" /> Files Modified ({d.changed_files.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {d.changed_files.map((f) => (
              <span key={f.path} className="rounded border border-border/50 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground" title={f.path}>
                {f.path}
              </span>
            ))}
          </div>
        </div>
      )}

      {(d.build_log || d.ai_diagnosis) && <BuildLogPanel d={d} />}
    </div>
  )
}

function BuildLogPanel({ d }: { d: DbDeployment }) {
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagnosis, setDiagnosis] = useState<string | null>(d.ai_diagnosis)
  const sb = createClient()

  async function diagnose() {
    setDiagnosing(true)
    const { data } = await sb.functions.invoke('diagnose-deployment', { body: { deployment_id: d.id } })
    setDiagnosis(data?.diagnosis ?? null)
    setDiagnosing(false)
  }

  return (
    <div className="space-y-3">
      {diagnosis ? (
        <div className="rounded-lg border border-ai/20 bg-ai/5 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-ai uppercase tracking-wider">
            <Sparkles className="h-3 w-3" /> AI Diagnosis
          </div>
          <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{diagnosis}</div>
        </div>
      ) : d.status === 'failed' ? (
        <button
          onClick={diagnose}
          disabled={diagnosing}
          className="flex items-center gap-1.5 rounded-lg border border-ai/30 bg-ai/8 px-3 py-1.5 text-xs font-medium text-ai hover:bg-ai/15 transition-colors disabled:opacity-60"
        >
          {diagnosing
            ? <><Loader2 className="h-3 w-3 animate-spin" /> Diagnosing…</>
            : <><Sparkles className="h-3 w-3" /> AI Diagnose</>
          }
        </button>
      ) : null}

      {d.build_log && (
        <details className="group">
          <summary className="cursor-pointer list-none text-[10px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ChevronDown className="h-3 w-3 group-open:hidden" />
            <ChevronUp className="h-3 w-3 hidden group-open:block" />
            Deployment Logs
          </summary>
          <pre className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border/50 bg-black/60 p-3 font-mono text-[10px] leading-relaxed text-green-400/80 scrollbar-thin">
            {d.build_log}
          </pre>
        </details>
      )}
    </div>
  )
}

function DeploymentRow({ d, repo }: { d: DbDeployment; repo?: RepoInfo }) {
  const [expanded, setExpanded] = useState(false)
  const duration = fmtDuration(d.duration_ms)

  return (
    <div>
      {d.ai_fix ? (
        <button onClick={() => setExpanded((v) => !v)} className="w-full px-5 py-4 space-y-3 text-left hover:bg-accent/20 transition-colors">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-ai/10 border border-ai/25 px-2 py-0.5 text-[10px] font-bold text-ai uppercase tracking-wider">
                <Sparkles className="h-2.5 w-2.5" /> AI Fix
              </span>
              <ToneBadge tone={statusTone(d.status)}>{d.status}</ToneBadge>
              <span className="rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{d.environment}</span>
              {duration && <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="h-2.5 w-2.5" />{duration}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-muted-foreground">{fmt(d.deployed_at)}</span>
              {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          </div>

          {d.release_notes && <p className="text-sm font-semibold text-foreground leading-snug">{d.release_notes.replace(/^AI Fix: /, '')}</p>}
          {d.ai_summary && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{d.ai_summary}</p>}

          <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
            {d.branch && <span className="flex items-center gap-1 font-mono"><GitBranch className="h-3 w-3" />{d.branch}</span>}
            {(d.commit_sha ?? d.git_commit) && <span className="flex items-center gap-1 font-mono"><Fingerprint className="h-3 w-3" />{(d.commit_sha ?? d.git_commit)!.slice(0, 7)}</span>}
            {d.deployed_by && <span>by {d.deployed_by.replace('user:', '')}</span>}
            {d.pr_number && <span className="flex items-center gap-1"><GitPullRequest className="h-3 w-3" />PR #{d.pr_number}</span>}
          </div>
        </button>
      ) : (
        <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-accent/20 transition-colors">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{d.version}</span>
              <ToneBadge tone={statusTone(d.status)}>{d.status}</ToneBadge>
              <span className="rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{d.environment}</span>
              <SourceBadge source={d.source} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{fmt(d.deployed_at)}</span>
              {duration && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{duration}</span>}
              {d.deployed_by && <span>by {d.deployed_by}</span>}
              {d.branch && <span className="flex items-center gap-1 font-mono"><GitBranch className="h-3 w-3" />{d.branch}</span>}
              {(d.commit_sha ?? d.git_commit) && (
                <span className="flex items-center gap-1 font-mono"><GitCommit className="h-3 w-3" />{(d.commit_sha ?? d.git_commit)!.slice(0, 7)}</span>
              )}
              {d.git_tag && <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{d.git_tag}</span>}
              {d.changed_files && d.changed_files.length > 0 && <span>{d.changed_files.length} file{d.changed_files.length === 1 ? '' : 's'} changed</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {d.status === 'failed' && (
              <span className="flex items-center gap-1 rounded-lg border border-critical/30 bg-critical/8 px-2.5 py-1 text-[10px] font-medium text-critical">
                <AlertTriangle className="h-3 w-3" /> Failed
              </span>
            )}
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        </button>
      )}
      {expanded && <DeploymentDetails d={d} repo={repo} />}
    </div>
  )
}

export default function DeploymentsPage() {
  const { app } = useConnectedApp()
  const [deployments, setDeployments] = useState<DbDeployment[]>([])
  const [repo, setRepo] = useState<RepoInfo | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [envFilter, setEnvFilter] = useState<EnvFilter>('all')
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()

    async function load() {
      setLoadError(null)
      const [{ data, error }, { data: repoData }] = await Promise.all([
        sb.from('deployment_registry')
          .select('id, version, environment, deployed_at, deployed_by, release_notes, status, git_commit, git_tag, changed_features, ai_fix, recommendation_id, pr_url, pr_number, ai_summary, ai_confidence, changed_files, source, build_log, ai_diagnosis, branch, commit_sha, duration_ms, validation_passed, validation_results, rollback_of_id, rolled_back_at, investigation_id')
          .eq('project_id', app.id)
          .order('deployed_at', { ascending: false })
          .limit(50),
        sb.from('project_repositories')
          .select('provider, repo_name, repo_url')
          .eq('project_id', app.id)
          .eq('status', 'active')
          .maybeSingle(),
      ])
      if (error) {
        // Surface real query failures instead of silently rendering "no
        // deployments" — this exact silent-failure pattern (a query for
        // columns that didn't exist live) was the actual root cause of
        // this page appearing empty despite real data existing.
        setLoadError(error.message)
        setDeployments([])
      } else {
        setDeployments((data ?? []) as DbDeployment[])
      }
      setRepo((repoData as RepoInfo | null) ?? undefined)
      setLoading(false)
    }

    load()

    const channel = sb
      .channel(`deployments-live:${app.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deployment_registry', filter: `project_id=eq.${app.id}` },
        (payload) => setDeployments((prev) => [payload.new as DbDeployment, ...prev].slice(0, 50)))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deployment_registry', filter: `project_id=eq.${app.id}` },
        (payload) => {
          const u = payload.new as DbDeployment
          setDeployments((prev) => prev.map((d) => d.id === u.id ? { ...d, ...u } : d))
        })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))

    return () => { sb.removeChannel(channel) }
  }, [app.id])

  const visible = envFilter === 'all' ? deployments : deployments.filter((d) => d.environment === envFilter)

  const stats = {
    total: deployments.length,
    aiFixes: deployments.filter((d) => d.ai_fix).length,
    success: deployments.filter((d) => d.status === 'success').length,
    failed: deployments.filter((d) => d.status === 'failed' || d.status === 'rolled-back').length,
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Rocket className="h-5 w-5" />}
        title="Deployment Intelligence"
        desc={repo ? `Every change pushed to ${repo.repo_name} — AI-generated fixes and manual releases, all in one place.` : 'Every change pushed to main — AI-generated fixes and manual releases, all in one place.'}
        actions={
          <div className="flex items-center gap-2">
            {live && (
              <span className="flex items-center gap-1.5 rounded-full border border-healthy/25 bg-healthy/10 px-2.5 py-1 text-[10px] font-semibold text-healthy">
                <Radio className="h-3 w-3 animate-pulse" /> LIVE
              </span>
            )}
            {stats.failed > 0
              ? <ToneBadge tone="critical" dot>{stats.failed} failed</ToneBadge>
              : deployments.length > 0
              ? <ToneBadge tone="healthy" dot>All deployments healthy</ToneBadge>
              : undefined}
          </div>
        }
      />

      {loadError && (
        <Card className="border-critical/30 bg-critical/5 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-critical" />
            <div>
              <p className="text-sm font-semibold text-critical">Couldn't load deployments</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">{loadError}</p>
            </div>
          </div>
        </Card>
      )}

      {/* KPI strip */}
      {deployments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total deployments', value: stats.total, tone: 'intel' as Tone },
            { label: 'AI-generated fixes', value: stats.aiFixes, tone: 'ai' as Tone, icon: <Sparkles className="h-3.5 w-3.5" /> },
            { label: 'Successful', value: stats.success, tone: 'healthy' as Tone },
            { label: 'Failed / rolled back', value: stats.failed, tone: (stats.failed > 0 ? 'critical' : 'healthy') as Tone },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                {s.icon && <span className="text-ai">{s.icon}</span>}
              </div>
              <p className={cn('mt-1.5 text-2xl font-semibold tabular-nums', {
                'text-ai': s.tone === 'ai',
                'text-healthy': s.tone === 'healthy',
                'text-critical': s.tone === 'critical',
                'text-foreground': s.tone === 'intel',
              })}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Env filters */}
      <div className="flex flex-wrap gap-1">
        {ENV_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setEnvFilter(f.id)}
            className={cn(
              'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
              envFilter === f.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Webhook setup card — still useful for Vercel/Netlify/Docker builds,
          which have no OAuth-based auto-registration path (unlike GitHub/
          GitLab/Azure/Bitbucket push events, which are now wired up
          automatically the moment a repo is connected). */}
      {app.id !== '__loading__' && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-intel" />
            <p className="text-sm font-semibold text-foreground">Connect External Build/Deploy Tools</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {repo
              ? `Pushes to ${repo.repo_name} are tracked automatically. Point Vercel, Netlify, or Docker Hub's webhook at this URL too, to capture their build/deploy status as well.`
              : 'Point your CI/CD webhook at this URL to capture Vercel, GitHub Actions, Netlify, Docker, and any other deployment source automatically.'}
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
            <code className="flex-1 truncate font-mono text-[11px] text-foreground">
              {`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/deployment-webhook?projectKey=${app.apiKey}`}
            </code>
            <CopyButton text={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/deployment-webhook?projectKey=${app.apiKey}`} />
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            Supports: GitHub • GitLab • Azure DevOps • Bitbucket • Vercel • Netlify • Docker Hub • Generic JSON
          </p>
        </Card>
      )}

      {loading ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : visible.length === 0 && !loadError ? (
        <Card className="p-10 text-center">
          <Rocket className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm font-medium text-foreground">No deployments yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-generated fixes and pushes to your connected repo will appear here automatically.
          </p>
        </Card>
      ) : visible.length > 0 ? (
        <Card>
          <div className="divide-y divide-border/50">
            {visible.map((d) => <DeploymentRow key={d.id} d={d} repo={repo} />)}
          </div>
        </Card>
      ) : null}
    </div>
  )
}
