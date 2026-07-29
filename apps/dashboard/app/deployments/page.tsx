'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import {
  Rocket, GitCommit, Tag, Radio, Sparkles, GitPullRequest,
  FileCode2, ExternalLink, GitMerge, Globe, Copy, Check,
  ChevronDown, ChevronUp, AlertTriangle, Loader2,
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
}

const SOURCE_LABELS: Record<string, string> = {
  'vercel': 'Vercel', 'github-actions': 'GitHub', 'netlify': 'Netlify',
  'docker': 'Docker', 'manual': 'Manual', 'paaq-ai': 'PAAQ AI', 'generic': 'Webhook',
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

const ENV_FILTERS: { id: EnvFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'production', label: 'Production' },
  { id: 'staging', label: 'Staging' },
  { id: 'development', label: 'Development' },
]

function AiFixCard({ d }: { d: DbDeployment }) {
  const files = d.changed_files ?? (d.changed_features ? d.changed_features.map((p) => ({ path: p })) : [])

  return (
    <div className="px-5 py-4 space-y-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-ai/10 border border-ai/25 px-2 py-0.5 text-[10px] font-bold text-ai uppercase tracking-wider">
            <Sparkles className="h-2.5 w-2.5" /> AI Fix
          </span>
          <ToneBadge tone={statusTone(d.status)}>{d.status}</ToneBadge>
          <span className="rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {d.environment}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">{fmt(d.deployed_at)}</span>
      </div>

      {/* Title */}
      {d.release_notes && (
        <p className="text-sm font-semibold text-foreground leading-snug">{d.release_notes.replace(/^AI Fix: /, '')}</p>
      )}

      {/* AI summary */}
      {d.ai_summary && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{d.ai_summary}</p>
      )}

      {/* Files changed */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <FileCode2 className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          {files.slice(0, 4).map((f) => (
            <span key={f.path} className="rounded border border-border/50 bg-muted/40 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground max-w-[180px] truncate" title={f.path}>
              {f.path.split('/').pop()}
            </span>
          ))}
          {files.length > 4 && <span className="text-[9px] text-muted-foreground/60">+{files.length - 4} more</span>}
        </div>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        {d.git_commit && (
          <span className="flex items-center gap-1 font-mono">
            <GitMerge className="h-3 w-3" /> {d.git_commit}
          </span>
        )}
        {d.deployed_by && <span>by {d.deployed_by.replace('user:', '')}</span>}
        {d.ai_confidence != null && (
          <span className="flex items-center gap-1 text-ai font-medium">
            <Sparkles className="h-2.5 w-2.5" /> {d.ai_confidence}% confidence
          </span>
        )}
        {d.pr_url && (
          <a
            href={d.pr_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-intel hover:text-foreground hover:underline transition-colors"
          >
            <GitPullRequest className="h-3 w-3" />
            {d.pr_number ? `PR #${d.pr_number}` : 'View PR'}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
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
    <div className="border-t border-border/50 bg-background/20 px-5 py-4 space-y-3">
      {/* AI diagnosis */}
      {diagnosis ? (
        <div className="rounded-lg border border-ai/20 bg-ai/5 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-ai uppercase tracking-wider">
            <Sparkles className="h-3 w-3" /> AI Diagnosis
          </div>
          <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{diagnosis}</div>
        </div>
      ) : (
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
      )}

      {/* Raw log */}
      {d.build_log && (
        <details className="group">
          <summary className="cursor-pointer list-none text-[10px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ChevronDown className="h-3 w-3 group-open:hidden" />
            <ChevronUp className="h-3 w-3 hidden group-open:block" />
            Show build log
          </summary>
          <pre className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border/50 bg-black/60 p-3 font-mono text-[10px] leading-relaxed text-green-400/80 scrollbar-thin">
            {d.build_log}
          </pre>
        </details>
      )}
    </div>
  )
}

function ManualDeployRow({ d }: { d: DbDeployment }) {
  const [expanded, setExpanded] = useState(false)
  const failed = d.status === 'failed' || d.status === 'rolled-back'

  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{d.version}</span>
            <ToneBadge tone={statusTone(d.status)}>{d.status}</ToneBadge>
            <span className="rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {d.environment}
            </span>
            <SourceBadge source={d.source} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{fmt(d.deployed_at)}</span>
            {d.deployed_by && <span>by {d.deployed_by}</span>}
            {d.git_commit && (
              <span className="flex items-center gap-1 font-mono">
                <GitCommit className="h-3 w-3" /> {d.git_commit.slice(0, 7)}
              </span>
            )}
            {d.git_tag && (
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" /> {d.git_tag}
              </span>
            )}
            {d.changed_features && d.changed_features.length > 0 && (
              <span>{d.changed_features.length} feature{d.changed_features.length === 1 ? '' : 's'} changed</span>
            )}
          </div>
        </div>
        {failed && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-critical/30 bg-critical/8 px-2.5 py-1 text-[10px] font-medium text-critical hover:bg-critical/15 transition-colors"
          >
            <AlertTriangle className="h-3 w-3" />
            {expanded ? 'Hide' : 'Diagnose'}
          </button>
        )}
      </div>
      {failed && expanded && <BuildLogPanel d={d} />}
    </div>
  )
}

export default function DeploymentsPage() {
  const { app } = useConnectedApp()
  const [deployments, setDeployments] = useState<DbDeployment[]>([])
  const [loading, setLoading] = useState(true)
  const [envFilter, setEnvFilter] = useState<EnvFilter>('all')
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()

    sb.from('deployment_registry')
      .select('id, version, environment, deployed_at, deployed_by, release_notes, status, git_commit, git_tag, changed_features, ai_fix, recommendation_id, pr_url, pr_number, ai_summary, ai_confidence, changed_files, source, build_log, ai_diagnosis')
      .eq('project_id', app.id)
      .order('deployed_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setDeployments((data ?? []) as DbDeployment[])
        setLoading(false)
      })

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
  const aiFixes = visible.filter((d) => d.ai_fix)
  const manual = visible.filter((d) => !d.ai_fix)

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
        desc="Every change pushed to main — AI-generated fixes and manual releases, all in one place."
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

      {/* Webhook setup card */}
      {app.id !== '__loading__' && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-intel" />
            <p className="text-sm font-semibold text-foreground">Connect External Deployments</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Point your CI/CD webhook at this URL to capture Vercel, GitHub Actions, Netlify, Docker, and any other deployment source automatically.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
            <code className="flex-1 truncate font-mono text-[11px] text-foreground">
              {`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/deployment-webhook?projectKey=${app.project_id_key}`}
            </code>
            <CopyButton text={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/deployment-webhook?projectKey=${app.project_id_key}`} />
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            Supports: Vercel • GitHub Actions • Netlify • Docker Hub • Generic JSON
          </p>
        </Card>
      )}

      {loading ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : visible.length === 0 ? (
        <Card className="p-10 text-center">
          <Rocket className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm font-medium text-foreground">No deployments yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-generated fixes and external deployments will appear here automatically.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* AI Fixes section */}
          {aiFixes.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
                <Sparkles className="h-3.5 w-3.5 text-ai" />
                <h3 className="text-sm font-semibold text-foreground">AI-Generated Fixes</h3>
                <span className="ml-1 rounded-full bg-ai/10 px-1.5 py-0.5 text-[10px] font-semibold text-ai">{aiFixes.length}</span>
              </div>
              <div className="divide-y divide-border/50">
                {aiFixes.map((d) => <AiFixCard key={d.id} d={d} />)}
              </div>
            </Card>
          )}

          {/* Manual deploys section */}
          {manual.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
                <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Manual Deployments</h3>
                <span className="ml-1 rounded-full bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{manual.length}</span>
              </div>
              <div className="divide-y divide-border/50">
                {manual.map((d) => <ManualDeployRow key={d.id} d={d} />)}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
