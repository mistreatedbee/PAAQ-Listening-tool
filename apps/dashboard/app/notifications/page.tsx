'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card, ToneBadge } from '@/components/kit'
import {
  Bell, Sparkles, ShieldAlert, Rocket, Gauge, Route,
  Search, TriangleAlert, Lightbulb, Radio, Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/data'

type Source = 'insight' | 'investigation' | 'recommendation' | 'anomaly' | 'deployment' | 'error'
type CategoryFilter = 'all' | Source

type FeedItem = {
  id: string
  source: Source
  title: string
  body: string
  tone: Tone
  tag: string
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

const SOURCE_META: Record<Source, { label: string; Icon: typeof Bell; tone: Tone }> = {
  insight:        { label: 'AI Insight',       Icon: Lightbulb,    tone: 'ai' },
  investigation:  { label: 'Investigation',    Icon: Search,        tone: 'intel' },
  recommendation: { label: 'Recommendation',   Icon: Sparkles,      tone: 'ai' },
  anomaly:        { label: 'Anomaly',           Icon: TriangleAlert, tone: 'warning' },
  deployment:     { label: 'Deployment',        Icon: Rocket,        tone: 'healthy' },
  error:          { label: 'Error',             Icon: ShieldAlert,   tone: 'critical' },
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

function insightTone(priority: string | null): Tone {
  if (priority === 'critical') return 'critical'
  if (priority === 'high') return 'warning'
  return 'ai'
}

function priorityTag(priority: string | null) {
  if (priority === 'critical') return 'Critical'
  if (priority === 'high') return 'High'
  if (priority === 'medium') return 'Medium'
  return 'Info'
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
      const [
        { data: insights },
        { data: investigations },
        { data: recommendations },
        { data: anomalies },
        { data: deployments },
        { data: errors },
      ] = await Promise.all([
        sb.from('ai_insights')
          .select('id, title, description, priority, category, created_at')
          .eq('project_id', app.id)
          .order('created_at', { ascending: false })
          .limit(30),
        sb.from('investigations')
          .select('id, title, status, priority, created_at')
          .eq('project_id', app.id)
          .order('created_at', { ascending: false })
          .limit(20),
        sb.from('recommendations')
          .select('id, title, type, status, risk_level, created_at')
          .eq('project_id', app.id)
          .order('created_at', { ascending: false })
          .limit(20),
        sb.from('anomaly_events')
          .select('id, type, severity, detected_pattern, created_at')
          .eq('project_id', app.id)
          .order('created_at', { ascending: false })
          .limit(20),
        sb.from('deployment_registry')
          .select('id, version, status, ai_fix, ai_summary, environment, deployed_at')
          .eq('project_id', app.id)
          .order('deployed_at', { ascending: false })
          .limit(15),
        sb.from('errors')
          .select('id, error_type, message, severity, created_at')
          .eq('project_id', app.id)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(15),
      ])

      const items: FeedItem[] = []

      for (const r of insights ?? []) {
        items.push({
          id: `insight-${r.id}`,
          source: 'insight',
          title: r.title ?? 'AI Insight',
          body: r.description ?? '',
          tone: insightTone(r.priority),
          tag: priorityTag(r.priority),
          created_at: r.created_at,
        })
      }

      for (const r of investigations ?? []) {
        items.push({
          id: `investigation-${r.id}`,
          source: 'investigation',
          title: r.title ?? 'Investigation',
          body: `Status: ${r.status ?? 'unknown'}`,
          tone: r.status === 'completed' ? 'healthy' : 'intel',
          tag: r.status ?? 'open',
          created_at: r.created_at,
        })
      }

      for (const r of recommendations ?? []) {
        items.push({
          id: `rec-${r.id}`,
          source: 'recommendation',
          title: r.title ?? 'Recommendation',
          body: r.type ?? '',
          tone: r.risk_level === 'critical' ? 'critical' : r.risk_level === 'high' ? 'warning' : 'ai',
          tag: r.risk_level ?? r.status ?? 'pending',
          created_at: r.created_at,
        })
      }

      for (const r of anomalies ?? []) {
        items.push({
          id: `anomaly-${r.id}`,
          source: 'anomaly',
          title: r.type ?? 'Anomaly detected',
          body: r.detected_pattern ?? '',
          tone: r.severity === 'critical' || r.severity === 'fatal' ? 'critical' : 'warning',
          tag: r.severity ?? 'warning',
          created_at: r.created_at,
        })
      }

      for (const r of deployments ?? []) {
        items.push({
          id: `deploy-${r.id}`,
          source: 'deployment',
          title: r.ai_fix ? `AI Fix deployed — ${r.version}` : `Deployment — ${r.version}`,
          body: r.ai_summary ?? `${r.environment ?? 'production'} · ${r.status}`,
          tone: r.status === 'success' ? 'healthy' : r.status === 'failed' ? 'critical' : 'intel',
          tag: r.status ?? 'deployed',
          created_at: r.deployed_at ?? r.id,
        })
      }

      for (const r of errors ?? []) {
        items.push({
          id: `error-${r.id}`,
          source: 'error',
          title: r.error_type ?? 'Runtime Error',
          body: r.message ?? '',
          tone: r.severity === 'fatal' ? 'critical' : r.severity === 'error' ? 'critical' : 'warning',
          tag: r.severity ?? 'error',
          created_at: r.created_at,
        })
      }

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setFeed(items)
      setLoading(false)
    }

    load()

    // Live subscriptions on the most active tables
    const channel = sb.channel(`activity-feed:${app.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_insights', filter: `project_id=eq.${app.id}` }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'recommendations', filter: `project_id=eq.${app.id}` }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'anomaly_events', filter: `project_id=eq.${app.id}` }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deployment_registry', filter: `project_id=eq.${app.id}` }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'errors', filter: `project_id=eq.${app.id}` }, load)
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))

    return () => { sb.removeChannel(channel) }
  }, [app.id])

  const visible = filter === 'all' ? feed : feed.filter((f) => f.source === filter)

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
        {live && (
          <span className="flex items-center gap-1.5 rounded-full border border-healthy/25 bg-healthy/10 px-2.5 py-1 text-[10px] font-semibold text-healthy">
            <Radio className="h-3 w-3 animate-pulse" /> LIVE
          </span>
        )}
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
                <div key={item.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-accent/20 transition-colors">
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
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-foreground leading-snug">{item.title}</p>
                    {item.body && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.body}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground/60 tabular-nums">
                    {timeAgo(item.created_at)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
