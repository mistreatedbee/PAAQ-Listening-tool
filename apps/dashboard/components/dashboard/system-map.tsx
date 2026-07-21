'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardHead, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneBg, toneText } from '@/lib/tones'
import { Network } from 'lucide-react'
import type { Tone } from '@/lib/data'

type LayerNode = {
  id: string
  name: string
  value: string
  sub: string
  status: 'healthy' | 'warning' | 'critical'
  detail: string
}

type RawMetrics = {
  eventCount: number
  sessionCount: number
  openErrors: number
  totalErrors: number
  avgResponseTime: number
  openIncidents: number
  apiRequests: number
}

function buildNodes(m: RawMetrics): LayerNode[] {
  const errorRate = m.totalErrors > 0 ? (m.openErrors / m.totalErrors) * 100 : 0
  return [
    {
      id: 'events',
      name: 'Events',
      value: String(m.eventCount),
      sub: 'total events',
      status: 'healthy',
      detail: `${m.eventCount} events captured across all sessions. Event stream is operating normally.`,
    },
    {
      id: 'sessions',
      name: 'Sessions',
      value: String(m.sessionCount),
      sub: 'active sessions',
      status: 'healthy',
      detail: `${m.sessionCount} sessions tracked in the platform. User activity is being recorded.`,
    },
    {
      id: 'errors',
      name: 'Errors',
      value: String(m.openErrors),
      sub: 'open errors',
      status: m.openErrors === 0 ? 'healthy' : m.openErrors < 5 ? 'warning' : 'critical',
      detail: `${m.openErrors} open errors out of ${m.totalErrors} total. Open rate: ${errorRate.toFixed(1)}%.`,
    },
    {
      id: 'performance',
      name: 'Performance',
      value: m.avgResponseTime > 0 ? `${Math.round(m.avgResponseTime)}ms` : '—',
      sub: 'avg response time',
      status: m.avgResponseTime === 0 ? 'healthy' : m.avgResponseTime < 200 ? 'healthy' : m.avgResponseTime < 500 ? 'warning' : 'critical',
      detail: `Average API response time is ${Math.round(m.avgResponseTime)}ms. ${m.avgResponseTime < 200 ? 'Well within SLA.' : 'Above target threshold.'}`,
    },
    {
      id: 'incidents',
      name: 'Incidents',
      value: String(m.openIncidents),
      sub: 'open incidents',
      status: m.openIncidents === 0 ? 'healthy' : m.openIncidents < 2 ? 'warning' : 'critical',
      detail: `${m.openIncidents} active incidents currently open. ${m.openIncidents === 0 ? 'All clear.' : 'Investigation in progress.'}`,
    },
    {
      id: 'api',
      name: 'API',
      value: String(m.apiRequests),
      sub: 'api requests',
      status: 'healthy',
      detail: `${m.apiRequests} API requests logged. Endpoint health is being monitored.`,
    },
  ]
}

const statusTone: Record<string, 'healthy' | 'warning' | 'critical'> = {
  healthy: 'healthy',
  warning: 'warning',
  critical: 'critical',
}

export function SystemMap() {
  const [nodes, setNodes] = useState<LayerNode[]>([])
  const [active, setActive] = useState<LayerNode | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('events').select('*', { count: 'exact', head: true }),
      sb.from('sessions').select('*', { count: 'exact', head: true }),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      sb.from('errors').select('*', { count: 'exact', head: true }),
      sb.from('performance_metrics').select('value').eq('metric_type', 'response_time').order('created_at', { ascending: false }).limit(20),
      sb.from('incidents').select('*', { count: 'exact', head: true }).neq('status', 'resolved'),
      sb.from('api_requests').select('*', { count: 'exact', head: true }),
    ]).then(([
      { count: eventCount },
      { count: sessionCount },
      { count: openErrors },
      { count: totalErrors },
      { data: perfData },
      { count: openIncidents },
      { count: apiRequests },
    ]) => {
      const vals = (perfData ?? []).map((r: { value: number }) => r.value)
      const avgResponseTime = vals.length > 0 ? vals.reduce((a: number, v: number) => a + v, 0) / vals.length : 0

      const raw: RawMetrics = {
        eventCount: eventCount ?? 0,
        sessionCount: sessionCount ?? 0,
        openErrors: openErrors ?? 0,
        totalErrors: totalErrors ?? 0,
        avgResponseTime,
        openIncidents: openIncidents ?? 0,
        apiRequests: apiRequests ?? 0,
      }

      const built = buildNodes(raw)
      setNodes(built)
      setActive(built.find((n) => n.status === 'critical') ?? built.find((n) => n.status === 'warning') ?? built[0])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHead title="Live System Map" desc="Real-time platform health" icon={<Network className="h-4 w-4" />} />
        <div className="px-5 pb-5">
          <div className="flex gap-1">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[90px] w-[132px] shrink-0 animate-pulse rounded-lg border border-border/60 bg-card/60" />
            ))}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHead
        title="Live System Map"
        desc="Real-time platform layer health"
        icon={<Network className="h-4 w-4" />}
        action={
          <ToneBadge tone="healthy" dot>
            {nodes.length} layers
          </ToneBadge>
        }
      />
      <div className="px-5 pb-5">
        {/* pipeline */}
        <div className="scrollbar-thin flex items-stretch gap-1 overflow-x-auto pb-3">
          {nodes.map((node, i) => {
            const tone = statusTone[node.status]
            const selected = active?.id === node.id
            return (
              <div key={node.id} className="flex items-stretch">
                <button
                  onClick={() => setActive(node)}
                  className={cn(
                    'group relative w-[132px] shrink-0 rounded-lg border p-3 text-left transition-all',
                    selected
                      ? 'border-border bg-accent/60 ring-1 ring-intel/40'
                      : 'border-border/60 bg-card/60 hover:border-border hover:bg-accent/30',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn('h-2 w-2 rounded-full', toneBg[tone], node.status !== 'healthy' && 'animate-pulse-dot')} />
                    <span className={cn('text-[10px] font-semibold uppercase', toneText[tone])}>{node.status}</span>
                  </div>
                  <p className="mt-2 truncate text-xs font-semibold text-foreground">{node.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{node.sub}</p>
                  <p className={cn('mt-1.5 text-sm font-bold tabular-nums', toneText[tone])}>{node.value}</p>
                </button>
                {i < nodes.length - 1 && (
                  <div className="flex w-5 items-center justify-center">
                    <svg width="20" height="10" aria-hidden="true">
                      <line x1="0" y1="5" x2="20" y2="5" stroke="var(--border)" strokeWidth="1.5" className="animate-flow" />
                    </svg>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* detail */}
        {active && (
          <div className="mt-1 rounded-lg border border-border/60 bg-background/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 rounded-full', toneBg[statusTone[active.status]])} />
                <h4 className="text-sm font-semibold text-foreground">{active.name}</h4>
                <ToneBadge tone={statusTone[active.status]}>{active.status}</ToneBadge>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{active.detail}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Value" value={active.value} tone={statusTone[active.status]} />
              <Stat label="Layer" value={active.name} />
              <Stat label="Status" value={active.status} tone={statusTone[active.status]} />
              <Stat label="Source" value={active.sub} />
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'healthy' | 'warning' | 'critical' }) {
  return (
    <div className="rounded-md border border-border/50 bg-card/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-sm font-semibold tabular-nums', tone ? toneText[tone] : 'text-foreground')}>{value}</p>
    </div>
  )
}
