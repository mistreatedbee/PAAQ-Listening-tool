'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Bug, CheckCircle2, EyeOff, Radio } from 'lucide-react'
import { PageHeader, Card, CardHead, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
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

type Filter = 'all' | 'open' | 'resolved' | 'ignored'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'ignored', label: 'Ignored' },
]

export default function ErrorsPage() {
  const { app } = useConnectedApp()
  const [rows, setRows] = useState<DbError[]>([])
  const [counts, setCounts] = useState({ total: 0, open: 0, resolved: 0, fatal: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [updating, setUpdating] = useState<string | null>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()

    const load = () => {
      Promise.all([
        sb.from('errors').select('id, error_type, message, severity, status, screen, created_at').eq('project_id', app.id).order('created_at', { ascending: false }).limit(100),
        sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
        sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'open'),
        sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'resolved'),
        sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('severity', 'fatal'),
      ]).then(([{ data }, { count: total }, { count: open }, { count: resolved }, { count: fatal }]) => {
        setRows((data ?? []) as DbError[])
        setCounts({ total: total ?? 0, open: open ?? 0, resolved: resolved ?? 0, fatal: fatal ?? 0 })
        setLoading(false)
      })
    }

    load()

    const channel = sb
      .channel(`errors-live:${app.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'errors', filter: `project_id=eq.${app.id}` },
        (payload) => {
          setRows((prev) => [payload.new as DbError, ...prev].slice(0, 100))
          setCounts((prev) => ({
            ...prev,
            total: prev.total + 1,
            open: (payload.new as DbError).status === 'open' ? prev.open + 1 : prev.open,
            fatal: (payload.new as DbError).severity === 'fatal' ? prev.fatal + 1 : prev.fatal,
          }))
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'errors', filter: `project_id=eq.${app.id}` },
        (payload) => {
          const updated = payload.new as DbError
          setRows((prev) => prev.map((r) => r.id === updated.id ? { ...r, ...updated } : r))
          // Recount open/resolved after any status change
          load()
        })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))

    return () => { sb.removeChannel(channel) }
  }, [app.id])

  const handleUpdateStatus = async (errorId: string, newStatus: string) => {
    setUpdating(errorId)
    const sb = createClient()
    const { error: dbErr } = await sb.from('errors').update({ status: newStatus }).eq('id', errorId)
    if (!dbErr) {
      setRows((prev) => prev.map((r) => r.id === errorId ? { ...r, status: newStatus } : r))
      setCounts((prev) => {
        const was = rows.find(r => r.id === errorId)?.status
        return {
          ...prev,
          open: newStatus === 'open' ? prev.open + 1 : (was === 'open' ? prev.open - 1 : prev.open),
          resolved: newStatus === 'resolved' ? prev.resolved + 1 : (was === 'resolved' ? prev.resolved - 1 : prev.resolved),
        }
      })
    }
    setUpdating(null)
  }

  const stats = [
    { label: 'Total', value: counts.total, tone: 'warning' as Tone },
    { label: 'Open', value: counts.open, tone: 'critical' as Tone },
    { label: 'Resolved', value: counts.resolved, tone: 'healthy' as Tone },
    { label: 'Fatal', value: counts.fatal, tone: 'critical' as Tone },
  ]

  const visible = filter === 'all' ? rows : rows.filter((r) => r.status === filter)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Bug className="h-5 w-5" />}
        title="Error Tracking"
        desc="Errors captured by the PAAQ SDK, ranked by recency and severity."
        actions={
          <div className="flex items-center gap-2">
            {live && (
              <span className="flex items-center gap-1.5 rounded-full border border-healthy/25 bg-healthy/10 px-2.5 py-1 text-[10px] font-semibold text-healthy">
                <Radio className="h-3 w-3 animate-pulse" /> LIVE
              </span>
            )}
            <ToneBadge tone="critical" dot>{`${counts.open} open`}</ToneBadge>
          </div>
        }
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
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <h3 className="text-sm font-semibold text-foreground">Recent Errors</h3>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                  filter === f.id
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
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Bug className="h-8 w-8 opacity-20" />
            <p className="text-sm">{filter === 'all' ? 'No errors captured yet.' : `No ${filter} errors.`}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {visible.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-accent/20 transition-colors group">
                <Link href={`/errors/${e.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ToneBadge tone={statusTone[e.status] ?? 'intel'}>{e.status}</ToneBadge>
                    <ToneBadge tone={severityTone[e.severity] ?? 'intel'}>{e.severity}</ToneBadge>
                    <span className="text-[11px] text-muted-foreground">{e.error_type}</span>
                  </div>
                  <p className="mt-1 truncate font-mono text-sm text-foreground">{e.message}</p>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    {e.screen && <span>{e.screen}</span>}
                    <span>{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                </Link>
                {/* Inline status actions */}
                <div className="flex shrink-0 items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {e.status !== 'resolved' && (
                    <button
                      onClick={() => handleUpdateStatus(e.id, 'resolved')}
                      disabled={updating === e.id}
                      title="Mark resolved"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-healthy/30 bg-healthy/10 text-healthy hover:bg-healthy/20 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {e.status === 'open' && (
                    <button
                      onClick={() => handleUpdateStatus(e.id, 'ignored')}
                      disabled={updating === e.id}
                      title="Ignore"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 bg-card/60 text-muted-foreground hover:bg-accent disabled:opacity-50"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
