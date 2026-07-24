'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card, CardHead, StatusDot } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText } from '@/lib/tones'
import { Users } from 'lucide-react'

type LiveStats = {
  onlineNow: number
  todayUsers: number
  todayEvents: number
  eventsPerMin: number
  connected: boolean
}

function ageLabel(iso: string | null | undefined): string {
  if (!iso) return 'Never'
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

export function LiveUsers() {
  const { app } = useConnectedApp()
  const [stats, setStats] = useState<LiveStats>({ onlineNow: 0, todayUsers: 0, todayEvents: 0, eventsPerMin: 0, connected: false })
  const [lastHeartbeats, setLastHeartbeats] = useState<{ frontend: string | null; backend: string | null; database: string | null }>({ frontend: null, backend: null, database: null })

  useEffect(() => {
    if (app.id === '__loading__') return
    let cancelled = false
    const sb = createClient()

    function load() {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const oneMinAgo  = new Date(Date.now() - 60 * 1000).toISOString()
      const midnight   = new Date(); midnight.setHours(0, 0, 0, 0)
      const todayStr   = midnight.toISOString()

      Promise.all([
        // Distinct user_ids in last 5 min (proxy for "online now")
        sb.from('events').select('user_id, properties').eq('project_id', app.id).gte('timestamp', fiveMinAgo),
        // Distinct user_ids today
        sb.from('events').select('user_id').eq('project_id', app.id).gte('timestamp', todayStr),
        // Events today total
        sb.from('events').select('*', { count: 'exact', head: true }).eq('project_id', app.id).gte('timestamp', todayStr),
        // Events in last minute (for events/min rate)
        sb.from('events').select('*', { count: 'exact', head: true }).eq('project_id', app.id).gte('timestamp', oneMinAgo),
      ]).then(([recent, todayRaw, todayCount, lastMinCount]) => {
        if (cancelled) return

        const recentData = recent.data ?? []
        // Count distinct sessions from properties._session or user_id
        const sessions = new Set(recentData.map((e) => {
          const p = e.properties as Record<string, unknown> | null
          return p?._session ?? e.user_id
        }).filter(Boolean))
        const onlineNow = sessions.size > 0 ? sessions.size : recentData.length

        const todayUserSet = new Set(
          ((todayRaw.data ?? []) as { user_id: string | null }[])
            .map((e) => e.user_id).filter(Boolean)
        )

        setStats({
          onlineNow,
          todayUsers: todayUserSet.size,
          todayEvents: todayCount.count ?? 0,
          eventsPerMin: lastMinCount.count ?? 0,
          connected: true,
        })
      })
    }

    load()

    const channel = sb
      .channel(`live-users-${app.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `project_id=eq.${app.id}` }, load)
      .subscribe((status) =>
        setStats((prev) => ({ ...prev, connected: status === 'SUBSCRIBED' }))
      )

    const timer = setInterval(load, 15_000)

    return () => {
      cancelled = true
      clearInterval(timer)
      sb.removeChannel(channel)
    }
  }, [app.id])

  useEffect(() => {
    setLastHeartbeats({
      frontend: app.sdkStatus.frontendLastSeen ?? null,
      backend:  app.sdkStatus.backendLastSeen  ?? null,
      database: app.sdkStatus.databaseLastSeen ?? null,
    })
  }, [app.sdkStatus])

  const sdkLayers = [
    { label: 'Frontend', status: app.sdkStatus.frontend, lastSeen: lastHeartbeats.frontend },
    { label: 'Backend',  status: app.sdkStatus.backend,  lastSeen: lastHeartbeats.backend  },
    { label: 'Database', status: app.sdkStatus.database, lastSeen: lastHeartbeats.database },
  ] as const

  if (app.id === '__loading__') return null

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-[1fr_auto]">
      {/* ── Live activity stats ── */}
      <Card className="flex-1">
        <CardHead
          title="Live Activity"
          desc="Real-time user engagement"
          icon={<Users className="h-4 w-4" />}
          action={
            <span className={cn(
              'flex items-center gap-1.5 text-[11px] font-medium',
              stats.connected ? 'text-healthy' : 'text-muted-foreground',
            )}>
              <span className={cn(
                'h-1.5 w-1.5 rounded-full',
                stats.connected ? 'bg-healthy animate-pulse-dot' : 'bg-muted-foreground',
              )} />
              {stats.connected ? 'Live' : 'Connecting…'}
            </span>
          }
        />
        <div className="grid grid-cols-2 gap-px bg-border/40 overflow-hidden rounded-b-xl sm:grid-cols-4">
          {[
            { label: 'Online Now',    value: stats.onlineNow,    sub: 'active sessions',  tone: stats.onlineNow > 0 ? 'healthy' : 'intel' },
            { label: 'Users Today',   value: stats.todayUsers,   sub: 'unique users',     tone: 'intel' },
            { label: 'Events Today',  value: stats.todayEvents,  sub: 'total events',     tone: 'intel' },
            { label: 'Events / min',  value: stats.eventsPerMin, sub: 'last 60 seconds',  tone: stats.eventsPerMin > 0 ? 'ai' : 'intel' },
          ].map((s) => (
            <div key={s.label} className="bg-card/60 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className={cn('mt-1 text-2xl font-semibold tabular-nums', toneText[s.tone as 'healthy' | 'intel' | 'ai'])}>
                {s.value.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground/60">{s.sub}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Connection Status ── */}
      <Card className="min-w-[260px]">
        <CardHead title="Connection Status" desc="SDK heartbeat per layer" />
        <div className="space-y-2 px-5 pb-5">
          {sdkLayers.map(({ label, status, lastSeen }) => (
            <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/30 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <StatusDot tone={status === 'connected' ? 'healthy' : status === 'degraded' ? 'warning' : 'intel'} pulse={status === 'connected'} />
                <span className="text-sm font-medium text-foreground">{label} SDK</span>
              </div>
              <div className="text-right">
                <p className={cn(
                  'text-xs font-semibold capitalize',
                  status === 'connected' ? 'text-healthy' : status === 'degraded' ? 'text-warning' : 'text-muted-foreground',
                )}>
                  {status}
                </p>
                {lastSeen && (
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {ageLabel(lastSeen)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
