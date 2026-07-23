'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Bug } from 'lucide-react'
import { PageHeader, Card, CardHead, ToneBadge, Meter } from '@/components/kit'
import type { Tone } from '@/lib/data'

const severityTone: Record<string, Tone> = {
  fatal: 'critical', error: 'critical', warning: 'warning', info: 'intel',
}
const statusTone: Record<string, Tone> = {
  open: 'warning', resolved: 'healthy', ignored: 'intel',
}

type DbError = {
  id: string
  error_type: string
  message: string
  severity: string
  status: string
  screen: string | null
  created_at: string
}

export default function ErrorsPage() {
  const { app } = useConnectedApp()
  const [rows, setRows] = useState<DbError[]>([])
  const [counts, setCounts] = useState({ total: 0, open: 0, resolved: 0, fatal: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()
    Promise.all([
      sb.from('errors').select('id, error_type, message, severity, status, screen, created_at').eq('project_id', app.id).order('created_at', { ascending: false }).limit(50),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'open'),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'resolved'),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('severity', 'fatal'),
    ]).then(([{ data }, { count: total }, { count: open }, { count: resolved }, { count: fatal }]) => {
      setRows((data ?? []) as DbError[])
      setCounts({ total: total ?? 0, open: open ?? 0, resolved: resolved ?? 0, fatal: fatal ?? 0 })
      setLoading(false)
    })
  }, [app.id])

  const stats = [
    { label: 'Total Errors', value: counts.total, tone: 'warning' as Tone },
    { label: 'Open', value: counts.open, tone: 'critical' as Tone },
    { label: 'Resolved', value: counts.resolved, tone: 'healthy' as Tone },
    { label: 'Fatal', value: counts.fatal, tone: 'critical' as Tone },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Bug className="h-5 w-5" />}
        title="Error Tracking"
        desc="Errors captured by the PAAQ SDK, ranked by recency and severity."
        actions={<ToneBadge tone="critical" dot>{`${counts.total} total errors`}</ToneBadge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHead title="Recent Errors" desc="Captured by the PAAQ SDK — most recent first." />
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Bug className="h-8 w-8 opacity-20" />
            <p className="text-sm">No errors captured yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((e, idx) => (
              <Link key={e.id} href={`/errors/${e.id}`} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:gap-6 hover:bg-accent/40 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ToneBadge tone={statusTone[e.status] ?? 'intel'}>{e.status}</ToneBadge>
                    <ToneBadge tone={severityTone[e.severity] ?? 'intel'}>{e.severity}</ToneBadge>
                    <span className="text-[11px] text-muted-foreground">{e.error_type}</span>
                  </div>
                  <p className="mt-1.5 truncate font-mono text-sm text-foreground">{e.message}</p>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    {e.screen && <span>Screen: {e.screen}</span>}
                    <span>{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="w-40">
                  <Meter value={Math.max(10, 100 - idx * (100 / rows.length))} tone={severityTone[e.severity] ?? 'intel'} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
