'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Bug, CheckCircle2, EyeOff, Radio, LayoutList, Layers } from 'lucide-react'
import { PageHeader, Card, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/data'

const severityTone: Record<string, Tone> = {
  fatal: 'critical', error: 'critical', warning: 'warning', info: 'intel',
}
const statusTone: Record<string, Tone> = {
  open: 'warning', resolved: 'healthy', ignored: 'intel',
}
const severityWeight: Record<string, number> = { fatal: 4, error: 3, warning: 2, info: 1 }

type DbError = {
  id: string
  error_type: string
  message: string
  severity: string
  status: string
  screen: string | null
  created_at: string
}

type ErrorGroup = {
  key: string
  error_type: string
  severity: string
  count: number
  openCount: number
  firstSeen: string
  lastSeen: string
  screens: string[]
  sample: DbError
}

function groupErrors(rows: DbError[]): ErrorGroup[] {
  const groups: Record<string, ErrorGroup> = {}
  for (const e of rows) {
    const key = e.error_type || 'Unknown'
    if (!groups[key]) {
      groups[key] = { key, error_type: key, severity: e.severity, count: 0, openCount: 0, firstSeen: e.created_at, lastSeen: e.created_at, screens: [], sample: e }
    }
    const g = groups[key]
    g.count++
    if (e.status === 'open') g.openCount++
    if (new Date(e.created_at) < new Date(g.firstSeen)) g.firstSeen = e.created_at
    if (new Date(e.created_at) > new Date(g.lastSeen)) { g.lastSeen = e.created_at; g.sample = e }
    if (e.screen && !g.screens.includes(e.screen)) g.screens.push(e.screen)
    if ((severityWeight[e.severity] ?? 0) > (severityWeight[g.severity] ?? 0)) g.severity = e.severity
  }
  return Object.values(groups).sort((a, b) => b.count - a.count)
}

function fmtShort(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

type Filter = 'all' | 'open' | 'resolved' | 'ignored'
type ViewMode = 'list' | 'groups'

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
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [updating, setUpdating] = useState<string | null>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()

    const load = () => {
      Promise.all([
        sb.from('errors').select('id, error_type, message, severity, status, screen, created_at').eq('project_id', app.id).order('created_at', { ascending: false }).limit(200),
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
          setRows((prev) => [payload.new as DbError, ...prev].slice(0, 200))
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

  const filteredRows = filter === 'all' ? rows : rows.filter((r) => r.status === filter)
  const groups = groupErrors(filteredRows)

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
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {viewMode === 'groups' ? `${groups.length} error types` : 'Recent Errors'}
          </h3>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/30 p-0.5">
              <button
                onClick={() => setViewMode('list')}
                title="List view"
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                  viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <LayoutList className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode('groups')}
                title="Grouped view"
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                  viewMode === 'groups' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Layers className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Status filters */}
            <div className="flex gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                    filter === f.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading…</div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Bug className="h-8 w-8 opacity-20" />
            <p className="text-sm">{filter === 'all' ? 'No errors captured yet.' : `No ${filter} errors.`}</p>
          </div>
        ) : viewMode === 'groups' ? (
          /* ── Grouped view ── */
          <div className="divide-y divide-border/60">
            {groups.map((g) => (
              <div key={g.key} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ToneBadge tone={severityTone[g.severity] ?? 'intel'}>{g.severity}</ToneBadge>
                      <span className="text-sm font-semibold text-foreground">{g.error_type}</span>
                      <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground tabular-nums">
                        ×{g.count}
                      </span>
                      {g.openCount > 0 && (
                        <ToneBadge tone="warning">{g.openCount} open</ToneBadge>
                      )}
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{g.sample.message}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                      <span>First: {fmtShort(g.firstSeen)}</span>
                      <span>Last: {fmtShort(g.lastSeen)}</span>
                      {g.screens.length > 0 && (
                        <span>{g.screens.slice(0, 3).join(', ')}{g.screens.length > 3 ? ` +${g.screens.length - 3}` : ''}</span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/errors/${g.sample.id}`}
                    className="shrink-0 rounded-lg border border-border/50 px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── List view ── */
          <div className="divide-y divide-border/60">
            {filteredRows.map((e) => (
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
                    <span>{fmtShort(e.created_at)}</span>
                  </div>
                </Link>
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
