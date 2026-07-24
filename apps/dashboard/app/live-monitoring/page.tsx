'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { PageHeader, Card, CardHead, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText, toneBg } from '@/lib/tones'
import { Radio, Zap, Users, AlertTriangle, Activity, BarChart3 } from 'lucide-react'
import type { Tone } from '@/lib/data'

type LiveEvent = {
  id: string
  event_name: string
  screen_name: string | null
  event_category: string | null
  timestamp: string
  properties: Record<string, unknown>
}

type LiveError = {
  id: string
  error_type: string
  message: string
  severity: string
  created_at: string
}

type CategoryCount = { category: string; count: number; tone: Tone }

function categoryTone(category: string | null): Tone {
  switch (category) {
    case 'navigation': return 'intel'
    case 'error':      return 'critical'
    case 'auth':       return 'warning'
    case 'feature':    return 'healthy'
    default:           return 'intel'
  }
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const EVENT_FILTERS = ['All', 'auth', 'navigation', 'feature', 'error', 'custom']

export default function LiveMonitoringPage() {
  const { app } = useConnectedApp()

  // stream state
  const [events, setEvents]             = useState<LiveEvent[]>([])
  const [authEvents, setAuthEvents]     = useState<LiveEvent[]>([])
  const [liveErrors, setLiveErrors]     = useState<LiveError[]>([])
  const [categories, setCategories]     = useState<CategoryCount[]>([])
  const [connected, setConnected]       = useState(false)
  const [filter, setFilter]             = useState('All')

  // headline stats
  const [onlineNow, setOnlineNow]       = useState(0)
  const [totalToday, setTotalToday]     = useState(0)
  const [openErrors, setOpenErrors]     = useState(0)
  const [eventsPerMin, setEventsPerMin] = useState(0)

  const lastMinEvents = useRef<string[]>([])

  useEffect(() => {
    if (app.id === '__loading__') return
    let cancelled = false
    const sb = createClient()

    function computeEventsPerMin() {
      const oneMinAgo = Date.now() - 60_000
      const recent = lastMinEvents.current.filter((ts) => new Date(ts).getTime() > oneMinAgo)
      lastMinEvents.current = recent
      setEventsPerMin(recent.length)
    }

    function loadInitial() {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const midnight = new Date(); midnight.setHours(0, 0, 0, 0)
      const todayStr = midnight.toISOString()

      // Recent events for timeline
      sb.from('events')
        .select('id, event_name, screen_name, event_category, timestamp, properties')
        .eq('project_id', app.id)
        .order('timestamp', { ascending: false })
        .limit(150)
        .then(({ data }) => {
          if (cancelled || !data) return
          const evts = data as LiveEvent[]
          setEvents(evts)
          setAuthEvents(evts.filter((e) => e.event_category === 'auth'))

          // Category breakdown
          const counts: Record<string, number> = {}
          evts.forEach((e) => { const c = e.event_category ?? 'custom'; counts[c] = (counts[c] ?? 0) + 1 })
          setCategories(
            Object.entries(counts)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => ({ category: cat, count, tone: categoryTone(cat) }))
          )
        })

      // Online now (distinct sessions in last 5 min)
      sb.from('events').select('user_id, properties').eq('project_id', app.id).gte('timestamp', fiveMinAgo)
        .then(({ data }) => {
          if (cancelled || !data) return
          const sessions = new Set(data.map((e) => {
            const p = e.properties as Record<string, unknown> | null
            return p?._session ?? e.user_id
          }).filter(Boolean))
          setOnlineNow(sessions.size > 0 ? sessions.size : data.length > 0 ? 1 : 0)
        })

      // Events today
      sb.from('events').select('*', { count: 'exact', head: true }).eq('project_id', app.id).gte('timestamp', todayStr)
        .then(({ count }) => { if (!cancelled) setTotalToday(count ?? 0) })

      // Open errors
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'open')
        .then(({ count }) => { if (!cancelled) setOpenErrors(count ?? 0) })

      // Recent errors
      sb.from('errors')
        .select('id, error_type, message, severity, created_at')
        .eq('project_id', app.id)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => { if (!cancelled && data) setLiveErrors(data as LiveError[]) })
    }

    loadInitial()

    // Realtime subscriptions
    const channel = sb
      .channel(`live-monitor-${app.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', filter: `project_id=eq.${app.id}` },
        (payload) => {
          const evt = payload.new as LiveEvent
          lastMinEvents.current.push(evt.timestamp)
          computeEventsPerMin()
          setTotalToday((n) => n + 1)
          setEvents((prev) => [evt, ...prev].slice(0, 200))
          if (evt.event_category === 'auth') {
            setAuthEvents((prev) => [evt, ...prev].slice(0, 50))
          }
          setCategories((prev) => {
            const cat = evt.event_category ?? 'custom'
            const idx = prev.findIndex((c) => c.category === cat)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = { ...next[idx], count: next[idx].count + 1 }
              return next.sort((a, b) => b.count - a.count)
            }
            return [...prev, { category: cat, count: 1, tone: categoryTone(cat) }].sort((a, b) => b.count - a.count)
          })
          // Recompute online now
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
          sb.from('events').select('user_id, properties').eq('project_id', app.id).gte('timestamp', fiveMinAgo)
            .then(({ data }) => {
              if (!data) return
              const sessions = new Set(data.map((e) => {
                const p = e.properties as Record<string, unknown> | null
                return p?._session ?? e.user_id
              }).filter(Boolean))
              setOnlineNow(sessions.size > 0 ? sessions.size : data.length > 0 ? 1 : 0)
            })
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'errors', filter: `project_id=eq.${app.id}` },
        (payload) => {
          setOpenErrors((n) => n + 1)
          setLiveErrors((prev) => [payload.new as LiveError, ...prev].slice(0, 20))
        },
      )
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'))

    const eventsPerMinTimer = setInterval(computeEventsPerMin, 15_000)
    const refreshTimer = setInterval(loadInitial, 60_000)

    return () => {
      cancelled = true
      clearInterval(eventsPerMinTimer)
      clearInterval(refreshTimer)
      sb.removeChannel(channel)
    }
  }, [app.id])

  const filtered = filter === 'All' ? events : events.filter((e) => (e.event_category ?? 'custom') === filter)

  const liveStats = [
    { label: 'Online Now',    value: onlineNow,       tone: onlineNow > 0 ? 'healthy' : 'intel',    icon: Users },
    { label: 'Events Today',  value: totalToday,      tone: 'intel',                                 icon: Zap },
    { label: 'Events / min',  value: eventsPerMin,    tone: eventsPerMin > 0 ? 'ai' : 'intel',       icon: Activity },
    { label: 'Open Errors',   value: openErrors,      tone: openErrors > 0 ? 'critical' : 'healthy', icon: AlertTriangle },
  ] as const

  const isEmpty = events.length === 0

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Radio className="h-5 w-5 text-healthy" />}
        title="Live Monitoring"
        desc="Real-time intelligence — every user action, error, and session update within seconds."
        actions={
          <div className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium',
            connected
              ? 'border-healthy/30 bg-healthy/10 text-healthy'
              : 'border-border/60 bg-card/60 text-muted-foreground',
          )}>
            <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-healthy animate-pulse-dot' : 'bg-muted-foreground')} />
            {connected ? 'Streaming live' : 'Connecting…'}
          </div>
        }
      />

      {/* ── Headline stats ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {liveStats.map(({ label, value, tone, icon: Icon }) => (
          <Card key={label} className="flex items-center gap-3 px-4 py-3.5">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', `bg-${tone}/10`)}>
              <Icon className={cn('h-4 w-4', toneText[tone as Tone])} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className={cn('text-2xl font-semibold tabular-nums', toneText[tone as Tone])}>{value.toLocaleString()}</p>
            </div>
          </Card>
        ))}
      </div>

      {isEmpty ? (
        /* ── Empty state ── */
        <Card>
          <div className="flex flex-col items-center gap-4 py-20 text-center px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-card">
              <Radio className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">No live activity detected yet</p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
                Your application is connected successfully and PAAQ Intelligence is waiting for events.
                As users begin interacting with your application, live analytics, AI insights, recommendations,
                and operational intelligence will appear here automatically.
              </p>
            </div>
            <div className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm',
              connected
                ? 'border-healthy/30 bg-healthy/10 text-healthy'
                : 'border-border/60 text-muted-foreground',
            )}>
              <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-healthy animate-pulse-dot' : 'bg-muted-foreground')} />
              {connected ? 'Stream connected — waiting for events' : 'Connecting to event stream…'}
            </div>
          </div>
        </Card>
      ) : (
        /* ── Main content ── */
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          {/* LEFT — Event Timeline */}
          <Card className="flex flex-col">
            <CardHead
              title="Event Timeline"
              desc="All events in real-time — most recent first"
              icon={<Zap className="h-4 w-4 text-intel" />}
              action={
                <div className="flex gap-1 flex-wrap">
                  {EVENT_FILTERS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                        filter === f
                          ? 'border-intel/40 bg-intel/15 text-intel'
                          : 'border-border/60 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              }
            />
            <ul className="flex-1 overflow-y-auto scrollbar-thin max-h-[600px]">
              {filtered.map((e) => {
                const tone = categoryTone(e.event_category)
                const session = (e.properties as Record<string, unknown>)?._session as string | null
                return (
                  <li key={e.id} className="flex gap-3 border-b border-border/30 px-4 py-2.5 hover:bg-accent/30 transition-colors animate-rise">
                    <div className="flex flex-col items-center pt-1.5">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', toneBg[tone])} />
                      <span className="mt-1 w-px flex-1 bg-border/40 min-h-[12px]" />
                    </div>
                    <div className="flex-1 min-w-0 pb-0.5">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <span className={cn('text-sm font-medium', toneText[tone])}>{e.event_name}</span>
                        <time className="shrink-0 font-mono text-[10px] text-muted-foreground">{formatTime(e.timestamp)}</time>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                        {e.event_category && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{e.event_category}</span>
                        )}
                        {e.screen_name && (
                          <span className="rounded border border-border/50 bg-card px-1.5 py-px text-[10px] text-muted-foreground">{e.screen_name}</span>
                        )}
                        {session && (
                          <span className="font-mono text-[9px] text-muted-foreground/50">
                            {(session as string).slice(0, 8)}…
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>

          {/* RIGHT — Session Events + Feature Usage + Errors */}
          <div className="flex flex-col gap-5">
            {/* Session / Auth Events */}
            <Card>
              <CardHead
                title="Session Events"
                desc="Auth activity — logins, signups, logouts"
                icon={<Users className="h-4 w-4 text-warning" />}
              />
              {authEvents.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <p className="text-xs">No auth events yet</p>
                  <p className="text-[10px] text-center px-4">Events with category "auth" appear here</p>
                </div>
              ) : (
                <ul className="max-h-[220px] overflow-y-auto scrollbar-thin divide-y divide-border/30">
                  {authEvents.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 px-4 py-2 hover:bg-accent/30 transition-colors animate-rise">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-warning">{e.event_name}</p>
                        {e.screen_name && <p className="text-[10px] text-muted-foreground">{e.screen_name}</p>}
                      </div>
                      <time className="shrink-0 text-[10px] text-muted-foreground">{formatTime(e.timestamp)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Feature Usage */}
            <Card>
              <CardHead
                title="Feature Usage"
                desc="Event categories captured today"
                icon={<BarChart3 className="h-4 w-4 text-ai" />}
              />
              {categories.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">No data yet</div>
              ) : (
                <div className="space-y-2 px-5 pb-5">
                  {categories.map(({ category, count, tone }) => {
                    const total = categories.reduce((a, c) => a + c.count, 0)
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0
                    return (
                      <div key={category}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={cn('h-1.5 w-1.5 rounded-full', toneBg[tone])} />
                            <span className="text-xs font-medium capitalize text-foreground">{category}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{count}</span>
                            <span className={cn('text-[10px] font-semibold', toneText[tone])}>{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1 w-full rounded-full bg-border/40 overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all', toneBg[tone])} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Live Errors */}
            <Card>
              <CardHead
                title="Live Errors"
                desc="Errors captured in real-time"
                icon={<AlertTriangle className="h-4 w-4 text-critical" />}
                action={
                  openErrors > 0
                    ? <ToneBadge tone="critical">{openErrors} open</ToneBadge>
                    : <ToneBadge tone="healthy">Clear</ToneBadge>
                }
              />
              {liveErrors.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <p className="text-xs">No errors detected</p>
                </div>
              ) : (
                <ul className="max-h-[200px] overflow-y-auto scrollbar-thin divide-y divide-border/30">
                  {liveErrors.map((e) => (
                    <li key={e.id} className="px-4 py-2 hover:bg-accent/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium text-critical line-clamp-1">{e.error_type || e.message}</p>
                        <ToneBadge tone={e.severity === 'fatal' ? 'critical' : e.severity === 'warning' ? 'warning' : 'critical'}>
                          {e.severity}
                        </ToneBadge>
                      </div>
                      {e.message && e.error_type && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">{e.message}</p>
                      )}
                      <time className="text-[10px] text-muted-foreground">{formatTime(e.created_at)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
