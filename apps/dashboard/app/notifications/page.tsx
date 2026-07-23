'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card, CardHead, ToneBadge } from '@/components/kit'
import { Bell, CheckCircle2, XCircle, Clock, MessageSquare, Mail, Smartphone } from 'lucide-react'
import type { Tone } from '@/lib/data'

type NotifStat = {
  label: string
  value: string | number
  sub?: string
  tone: Tone
  Icon: typeof Bell
}

type NotifLog = {
  id: string
  type: string | null
  channel: string | null
  status: string | null
  recipient: string | null
  created_at: string
  error_message: string | null
}

function notifTone(s: string | null): Tone {
  if (s === 'delivered' || s === 'success') return 'healthy'
  if (s === 'failed' || s === 'error') return 'critical'
  if (s === 'pending' || s === 'queued') return 'warning'
  return 'intel'
}

function channelIcon(c: string | null) {
  if (c === 'email') return Mail
  if (c === 'push') return Smartphone
  if (c === 'sms') return MessageSquare
  return Bell
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export default function NotificationsPage() {
  const { app } = useConnectedApp()
  const [stats, setStats] = useState<NotifStat[]>([])
  const [logs, setLogs] = useState<NotifLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()
    Promise.all([
      sb.from('notifications').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      sb.from('notifications').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'delivered'),
      sb.from('notifications').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'failed'),
      sb.from('notifications').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'pending'),
      sb.from('notifications').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('channel', 'email'),
      sb.from('notifications').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('channel', 'push'),
      sb.from('notifications')
        .select('id, type, channel, status, recipient, created_at, error_message')
        .eq('project_id', app.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]).then(([
      { count: total },
      { count: delivered },
      { count: failed },
      { count: pending },
      { count: emailCount },
      { count: pushCount },
      { data: logData },
    ]) => {
      const t = total ?? 0
      const d = delivered ?? 0
      const f = failed ?? 0
      const rate = t > 0 ? Math.round((d / t) * 100) : 0
      setStats([
        {
          label: 'Delivery Rate',
          value: `${rate}%`,
          sub: `${d} / ${t} delivered`,
          tone: rate >= 98 ? 'healthy' : rate >= 90 ? 'warning' : 'critical',
          Icon: CheckCircle2,
        },
        {
          label: 'Failed Sends',
          value: f,
          sub: f === 0 ? 'No failures' : 'Requires attention',
          tone: f === 0 ? 'healthy' : f < 10 ? 'warning' : 'critical',
          Icon: XCircle,
        },
        {
          label: 'Queued',
          value: pending ?? 0,
          sub: 'Pending delivery',
          tone: (pending ?? 0) < 20 ? 'healthy' : 'warning',
          Icon: Clock,
        },
        {
          label: 'Channels',
          value: `${emailCount ?? 0} email · ${pushCount ?? 0} push`,
          sub: 'Last 24h sends',
          tone: 'intel',
          Icon: Bell,
        },
      ])
      setLogs((logData ?? []) as NotifLog[])
      setLoading(false)
    })
  }, [app.id])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-intel/10">
          <Bell className="h-5 w-5 text-intel" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Notification & Messaging Health</h1>
          <p className="text-xs text-muted-foreground">
            Email, push, and SMS delivery rates across all PAAQ modules
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {loading
          ? Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-border/40 bg-card/60" />
            ))
          : stats.map((s) => {
              const Icon = s.Icon
              return (
                <Card key={s.label} className="p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <ToneBadge tone={s.tone} dot>
                      {s.tone === 'healthy' ? 'OK' : s.tone === 'warning' ? 'Warn' : s.tone === 'critical' ? 'Alert' : 'Live'}
                    </ToneBadge>
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-foreground">{s.value}</p>
                  <p className="text-[11px] font-medium text-foreground">{s.label}</p>
                  {s.sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{s.sub}</p>}
                </Card>
              )
            })}
      </div>

      {/* Notification log */}
      <Card>
        <CardHead
          title="Notification Feed"
          desc="Most recent messages sent — email, push, and SMS across all modules"
        />
        <div className="divide-y divide-border/40 px-5 pb-5">
          {loading
            ? Array(10).fill(0).map((_, i) => (
                <div key={i} className="py-3 flex gap-3">
                  <div className="h-3 w-44 animate-pulse rounded bg-card" />
                  <div className="h-3 w-12 animate-pulse rounded bg-card ml-auto" />
                </div>
              ))
            : logs.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No notification logs found</div>
            ) : (
              logs.map((n) => {
                const tone = notifTone(n.status)
                const CIcon = channelIcon(n.channel)
                return (
                  <div key={n.id} className="flex items-center gap-3 py-2.5">
                    <CIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{n.type ?? 'notification'}</p>
                      {n.recipient && (
                        <p className="text-[10px] text-muted-foreground truncate">{n.recipient}</p>
                      )}
                      {n.error_message && (
                        <p className="text-[10px] text-critical truncate">{n.error_message}</p>
                      )}
                    </div>
                    <ToneBadge tone={tone}>{n.status ?? 'unknown'}</ToneBadge>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                )
              })
            )}
        </div>
      </Card>
    </div>
  )
}
