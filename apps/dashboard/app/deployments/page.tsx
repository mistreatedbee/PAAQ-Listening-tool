'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Rocket, GitCommit, Tag } from 'lucide-react'
import { PageHeader, Card, CardHead, ToneBadge } from '@/components/kit'
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

function statusTone(s: string): Tone {
  if (s === 'success') return 'healthy'
  if (s === 'failed') return 'critical'
  if (s === 'rolled-back') return 'warning'
  return 'intel'
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function DeploymentsPage() {
  const { app } = useConnectedApp()
  const [deployments, setDeployments] = useState<DbDeployment[]>([])
  const [loading, setLoading] = useState(true)

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
  }, [app.id])

  const failed = deployments.filter((d) => d.status === 'failed' || d.status === 'rolled-back').length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Rocket className="h-5 w-5" />}
        title="Deployment Intelligence"
        desc="Release history for this project — record deployments in Knowledge Base → Deployments to see them here."
        actions={
          failed > 0
            ? <ToneBadge tone="critical" dot>{failed} failed / rolled back</ToneBadge>
            : deployments.length > 0
            ? <ToneBadge tone="healthy" dot>All deployments healthy</ToneBadge>
            : undefined
        }
      />

      <Card>
        <CardHead title="Recent Deployments" desc="Real deployment records for this project." />
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : deployments.length === 0 ? (
          <div className="p-10 text-center">
            <Rocket className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">
              No deployments tracked yet. Add one in Knowledge Base → Deployments to see release history here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {deployments.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
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
