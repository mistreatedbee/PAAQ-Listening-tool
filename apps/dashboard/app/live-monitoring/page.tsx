'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { PageHeader, Card, CardHead } from '@/components/kit'
import { SystemMap } from '@/components/dashboard/system-map'
import { cn } from '@/lib/utils'
import { toneText, toneBg } from '@/lib/tones'
import { Radio, Zap } from 'lucide-react'
import type { Tone } from '@/lib/data'

type LiveEvent = {
  id: string
  event_name: string
  screen_name: string | null
  event_category: string | null
  timestamp: string
  properties: Record<string, unknown>
}

function categoryTone(category: string | null): Tone {
  switch (category) {
    case 'navigation': return 'intel'
    case 'error':      return 'critical'
    case 'auth':       return 'warning'
    case 'feature':    return 'healthy'
    default:           return 'intel'
  }
}

export default function LiveMonitoringPage() {
  const { app } = useConnectedApp()
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [totalEvents, setTotalEvents] = useState(0)
  const [activeSessions, setActiveSessions] = useState(0)
  const [errorCount, setErrorCount] = useState(0)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()

    sb.from('events')
      .select('id, event_name, screen_name, event_category, timestamp, properties')
      .eq('project_id', app.id)
      .order('timestamp', { ascending: false })
      .limit(100)
      .then(({ data }) => { if (data) setEvents(data as LiveEvent[]) })

    sb.from('events').select('*', { count: 'exact', head: true }).eq('project_id', app.id)
      .then(({ count }) => { if (count != null) setTotalEvents(count) })

    sb.from('sessions').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'active')
      .then(({ count }) => { if (count != null) setActiveSessions(count) })

    sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'open')
      .then(({ count }) => { if (count != null) setErrorCount(count) })

    const channel = sb
      .channel(`live-platform-${app.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `project_id=eq.${app.id}` },
        (payload) => {
          setEvents((prev) => [payload.new as LiveEvent, ...prev].slice(0, 200))
          setTotalEvents((n) => n + 1)
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'errors', filter: `project_id=eq.${app.id}` },
        () => setErrorCount((n) => n + 1))
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'))

    return () => { sb.removeChannel(channel) }
  }, [app.id])

  const liveStats = [
    { label: 'Total Events', value: totalEvents.toLocaleString(), tone: 'intel' as Tone },
    { label: 'Active Sessions', value: activeSessions.toLocaleString(), tone: 'healthy' as Tone },
    { label: 'Open Errors', value: errorCount.toLocaleString(), tone: errorCount > 0 ? 'critical' as Tone : 'healthy' as Tone },
    { label: 'Stream', value: connected ? 'Live' : 'Connecting', tone: connected ? 'healthy' as Tone : 'warning' as Tone },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Radio className="h-5 w-5 text-healthy" />}
        title="Live Monitoring"
        desc="Real-time stream of every user action captured by the PAAQ SDK."
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

      <div className="grid gap-3 md:grid-cols-4">
        {liveStats.map((s) => (
          <Card key={s.label} className="px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className={cn('mt-1 text-2xl font-semibold', toneText[s.tone])}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SystemMap />
        </div>

        <Card>
          <CardHead
            title="Event Stream"
            desc="Incoming events · real-time"
            icon={<Zap className="h-4 w-4 text-intel" />}
          />
          {events.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <Zap className="h-8 w-8 opacity-20" />
              <p className="text-sm">Waiting for events…</p>
              <p className="text-xs text-center px-4">Send events from your app using the PAAQ Flutter SDK</p>
            </div>
          ) : (
            <ul className="max-h-[480px] divide-y divide-border/40 overflow-y-auto scrollbar-thin">
              {events.map((e) => {
                const tone = categoryTone(e.event_category)
                return (
                  <li key={e.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-accent/30 transition-colors animate-rise">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', toneBg[tone])} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-sm font-medium', toneText[tone])}>{e.event_name}</span>
                        {e.screen_name && (
                          <span className="rounded border border-border/60 bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {e.screen_name}
                          </span>
                        )}
                      </div>
                      {e.event_category && (
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{e.event_category}</p>
                      )}
                    </div>
                    <time className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </time>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHead title="Throughput" desc="Events across all sessions · live data" />
        <div className="flex flex-col items-center gap-2 px-5 py-12 text-muted-foreground">
          <Radio className="h-8 w-8 opacity-20" />
          <p className="text-sm">Throughput history will appear once events are streaming from your app.</p>
        </div>
      </Card>
    </div>
  )
}
