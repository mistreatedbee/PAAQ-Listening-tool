'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card, ToneBadge } from '@/components/kit'
import {
  Bell, Sparkles, ShieldAlert, Rocket, Search, TriangleAlert,
  Lightbulb, Radio, Filter, CheckCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/data'

type Source = 'insight' | 'investigation' | 'recommendation' | 'anomaly' | 'deployment' | 'error'
type CategoryFilter = 'all' | Source

type DbNotification = {
  id: string
  category: string | null
  type: string | null
  message: string
  severity: 'critical' | 'warning' | 'info' | 'success'
  read_at: string | null
  created_at: string
}

type FeedItem = {
  id: string
  source: Source
  title: string
  tone: Tone
  tag: string
  read: boolean
  created_at: string
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const SOURCE_META: Record<Source, { label: string; Icon: typeof Bell }> = {
  insight:        { label: 'AI Insight',     Icon: Lightbulb },
  investigation:  { label: 'Investigation',  Icon: Search },
  recommendation: { label: 'Recommendation', Icon: Sparkles },
  anomaly:        { label: 'Anomaly',        Icon: TriangleAlert },
  deployment:     { label: 'Deployment',     Icon: Rocket },
  error:          { label: 'Error',          Icon: ShieldAlert },
}

const FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: 'all',            label: 'All' },
  { id: 'insight',        label: 'Insights' },
  { id: 'investigation',  label: 'Investigations' },
  { id: 'recommendation', label: 'Recommendations' },
  { id: 'anomaly',        label: 'Anomalies' },
  { id: 'deployment',     label: 'Deployments' },
  { id: 'error',          label: 'Errors' },
]

function severityTone(severity: string): Tone {
  if (severity === 'critical') return 'critical'
  if (severity === 'warning') return 'warning'
  if (severity === 'success') return 'healthy'
  return 'intel'
}

function toFeedItem(n: DbNotification): FeedItem {
  const source = (n.category ?? 'insight') as Source
  return {
    id: n.id,
    source: source in SOURCE_META ? source : 'insight',
    title: n.message,
    tone: severityTone(n.severity),
    tag: n.severity,
    read: n.read_at !== null,
    created_at: n.created_at,
  }
}

export default function NotificationsPage() {
  const { app } = useConnectedApp()
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()

    const load = async () => {
      const { data } = await sb.from('notifications')
        .select('id, category, type, message, severity, read_at, created_at')
        .eq('project_id', app.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setFeed(((data ?? []) as DbNotification[]).map(toFeedItem))
      setLoading(false)
    }

    load()

    const channel = sb.channel(`notifications:${app.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `project_id=eq.${app.id}` }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `project_id=eq.${app.id}` }, load)
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))

    return () => { sb.removeChannel(channel) }
  }, [app.id])

  const markAsRead = async (id: string) => {
    const sb = createClient()
    setFeed((prev) => prev.map((f) => (f.id === id ? { ...f, read: true } : f)))
    await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  }

  const markAllAsRead = async () => {
    const sb = createClient()
    setFeed((prev) => prev.map((f) => ({ ...f, read: true })))
    await sb.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('project_id', app.id)
      .is('read_at', null)
  }

  const visible = filter === 'all' ? feed : feed.filter((f) => f.source === filter)
  const unreadCount = feed.filter((f) => !f.read).length

  const counts = {
    insight:        feed.filter((f) => f.source === 'insight').length,
    investigation:  feed.filter((f) => f.source === 'investigation').length,
    recommendation: feed.filter((f) => f.source === 'recommendation').length,
    anomaly:        feed.filter((f) => f.source === 'anomaly').length,
    deployment:     feed.filter((f) => f.source === 'deployment').length,
    error:          feed.filter((f) => f.source === 'error').length,
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ai/10">
            <Bell className="h-5 w-5 text-ai" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">AI Activity Stream</h1>
            <p className="text-xs text-muted-foreground">
              Live feed of investigations, recommendations, anomalies, deployments and errors
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
            </button>
          )}
          {live && (
            <span className="flex items-center gap-1.5 rounded-full border border-healthy/25 bg-healthy/10 px-2.5 py-1 text-[10px] font-semibold text-healthy">
              <Radio className="h-3 w-3 animate-pulse" /> LIVE
            </span>
          )}
        </div>
      </div>

      {/* KPI strip */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {(Object.entries(counts) as [Source, number][]).map(([source, count]) => {
            const meta = SOURCE_META[source]
            const Icon = meta.Icon
            return (
              <button
                key={source}
                onClick={() => setFilter(filter === source ? 'all' : source)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border p-3 transition-all text-center',
                  filter === source
                    ? 'border-ai/40 bg-ai/8 ring-2 ring-ai/20'
                    : 'border-border/50 bg-card/60 hover:bg-accent/30',
                )}
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-lg font-bold tabular-nums text-foreground">{count}</span>
                <span className="text-[9px] text-muted-foreground leading-tight">{meta.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Category filters */}
      <div className="flex items-center gap-1 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
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

      {/* Feed */}
      <Card>
        {loading ? (
          <div className="flex flex-col gap-3 p-5">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-muted/60" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-muted/60" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/40" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Bell className="h-8 w-8 text-muted-foreground opacity-20" />
            <p className="text-sm font-medium text-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {filter === 'all'
                ? 'Run AI Analysis from the User Journey or Dashboard page to start generating insights.'
                : `No ${filter} events recorded yet.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {visible.map((item) => {
              const meta = SOURCE_META[item.source]
              const Icon = meta.Icon
              return (
                <button
                  key={item.id}
                  onClick={() => !item.read && markAsRead(item.id)}
                  className={cn(
                    'flex w-full items-start gap-3 px-5 py-3.5 text-left hover:bg-accent/20 transition-colors',
                    !item.read && 'bg-ai/[0.03]',
                  )}
                >
                  <div className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
                    item.tone === 'critical' ? 'border-critical/30 bg-critical/10 text-critical'
                    : item.tone === 'warning'  ? 'border-warning/30 bg-warning/10 text-warning'
                    : item.tone === 'healthy'  ? 'border-healthy/30 bg-healthy/10 text-healthy'
                    : item.tone === 'ai'       ? 'border-ai/30 bg-ai/10 text-ai'
                    : 'border-border/50 bg-muted/40 text-muted-foreground',
                  )}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {meta.label}
                      </span>
                      <ToneBadge tone={item.tone}>{item.tag}</ToneBadge>
                      {!item.read && <span className="h-1.5 w-1.5 rounded-full bg-ai" />}
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-foreground leading-snug">{item.title}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground/60 tabular-nums">
                    {timeAgo(item.created_at)}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
