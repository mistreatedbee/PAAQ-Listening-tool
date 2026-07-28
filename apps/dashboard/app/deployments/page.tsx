'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Rocket, GitCommit, Tag, Radio } from 'lucide-react'
import { PageHeader, Card, CardHead, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/data'

type DbDeployment = {
  id: string
  version: string
  environment: string
  deployed_at: string
  deployed_by: string | null
  status: string
  git_commit: string | null
  git_tag: string | null
  changed_features: string[] | null
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
      .select('id, version, environment, deployed_at, deployed_by, status, git_commit, git_tag, changed_features')
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
        (payload) => {
          setDeployments((prev) => [payload.new as DbDeployment, ...prev].slice(0, 50))
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deployment_registry', filter: `project_id=eq.${app.id}` },
        (payload) => {
          const updated = payload.new as DbDeployment
          setDeployments((prev) => prev.map((d) => d.id === updated.id ? { ...d, ...updated } : d))
        })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))

    return () => { sb.removeChannel(channel) }
  }, [app.id])

  const visible = envFilter === 'all' ? deployments : deployments.filter((d) => d.environment === envFilter)

  const stats = {
    total: deployments.length,
    success: deployments.filter((d) => d.status === 'success').length,
    failed: deployments.filter((d) => d.status === 'failed' || d.status === 'rolled-back').length,
    inProgress: deployments.filter((d) => d.status === 'in-progress').length,
  }

  const statCards = [
    { label: 'Total', value: stats.total, tone: 'intel' as Tone },
    { label: 'Successful', value: stats.success, tone: 'healthy' as Tone },
    { label: 'Failed / Rolled back', value: stats.failed, tone: (stats.failed > 0 ? 'critical' : 'healthy') as Tone },
    { label: 'In progress', value: stats.inProgress, tone: (stats.inProgress > 0 ? 'warning' : 'intel') as Tone },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Rocket className="h-5 w-5" />}
        title="Deployment Intelligence"
        desc="Release history for this project — record deployments in Knowledge Base → Deployments."
        actions={
          <div className="flex items-center gap-2">
            {live && (
              <span className="flex items-center gap-1.5 rounded-full border border-healthy/25 bg-healthy/10 px-2.5 py-1 text-[10px] font-semibold text-healthy">
                <Radio className="h-3 w-3 animate-pulse" /> LIVE
              </span>
            )}
            {stats.failed > 0
              ? <ToneBadge tone="critical" dot>{stats.failed} failed / rolled back</ToneBadge>
              : deployments.length > 0
              ? <ToneBadge tone="healthy" dot>All deployments healthy</ToneBadge>
              : undefined
            }
          </div>
        }
      />

      {deployments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s) => (
            <Card key={s.label} className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <h3 className="text-sm font-semibold text-foreground">Recent Deployments</h3>
          <div className="flex gap-1">
            {ENV_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setEnvFilter(f.id)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                  envFilter === f.id
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center">
            <Rocket className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">
              {deployments.length === 0
                ? 'No deployments tracked yet. Add one in Knowledge Base → Deployments.'
                : `No ${envFilter} deployments found.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {visible.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{d.version}</span>
                    <ToneBadge tone={statusTone(d.status)}>{d.status}</ToneBadge>
                    <span className="rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {d.environment}
                    </span>
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
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
