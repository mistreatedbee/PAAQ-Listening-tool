'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card, CardHead, ToneBadge, StatusDot } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneBg, toneText } from '@/lib/tones'
import { MessageCircle, Calendar, Users, BookOpen, Gauge, Database, type LucideIcon } from 'lucide-react'
import type { Tone } from '@/lib/data'

/* ── PAAQ module definitions ─────────────────────────────────────────────── */
type ModuleDef = {
  id: string
  label: string
  sub: string
  Icon: LucideIcon
  patterns: RegExp[]
  accent: Tone
}

const MODULES: ModuleDef[] = [
  {
    id: 'ask',
    label: 'Ask',
    sub: 'Q&A · Credibility',
    Icon: MessageCircle,
    patterns: [/ask|question|q.?a|answer|credib|expert/i],
    accent: 'intel',
  },
  {
    id: 'book',
    label: 'Book',
    sub: 'Sessions · Advisory',
    Icon: Calendar,
    patterns: [/book|session|advisor|schedule|slot|advisory|booking|escrow/i],
    accent: 'healthy',
  },
  {
    id: 'attend',
    label: 'Attend',
    sub: 'Events · Ticketing',
    Icon: Users,
    patterns: [/attend|event|conference|webinar|ticket|live|speak|sponsor/i],
    accent: 'ai',
  },
  {
    id: 'learn',
    label: 'Learn',
    sub: 'Courses · Classes',
    Icon: BookOpen,
    patterns: [/learn|course|masterclass|lesson|class|module|teach|enroll/i],
    accent: 'warning',
  },
]

type ModuleNode = {
  id: string
  label: string
  sub: string
  Icon: LucideIcon
  accent: Tone
  events: number
  errors: number
  status: 'healthy' | 'warning' | 'critical' | 'idle'
  detail: string
}

type InfraNode = {
  id: string
  label: string
  sub: string
  Icon: LucideIcon
  value: string
  status: 'healthy' | 'warning' | 'critical'
  detail: string
}

function classify(screenName: string | null, category: string | null, patterns: RegExp[]): boolean {
  const text = [screenName, category].filter(Boolean).join(' ')
  return patterns.some((p) => p.test(text))
}

function moduleStatus(events: number, errors: number): 'healthy' | 'warning' | 'critical' | 'idle' {
  if (events === 0) return 'idle'
  const rate = errors / events
  if (rate === 0 || rate < 0.03) return 'healthy'
  if (rate < 0.12) return 'warning'
  return 'critical'
}

function statusToneOf(s: 'healthy' | 'warning' | 'critical' | 'idle'): Tone {
  if (s === 'idle') return 'intel'
  return s
}

type SelectedNode = {
  label: string
  sub: string
  status: string
  events?: number
  errors?: number
  value?: string
  detail: string
  accent: Tone
}

export function SystemMap() {
  const { app } = useConnectedApp()
  const [modules, setModules] = useState<ModuleNode[]>([])
  const [infra, setInfra] = useState<InfraNode[]>([])
  const [selected, setSelected] = useState<SelectedNode | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()
    Promise.all([
      sb.from('events').select('event_name, event_category, screen_name').eq('project_id', app.id).limit(1000),
      sb.from('errors').select('error_type, severity, status, screen').eq('project_id', app.id).limit(500),
      sb.from('performance_metrics').select('metric_type, value').eq('metric_type', 'response_time').order('created_at', { ascending: false }).limit(20),
      sb.from('incidents').select('*', { count: 'exact', head: true }).eq('project_id', app.id).neq('status', 'resolved'),
    ]).then(([{ data: evts }, { data: errs }, { data: perf }, { count: openInc }]) => {
      const events = evts ?? []
      const errors = errs ?? []

      /* ── Module nodes ── */
      const moduleNodes: ModuleNode[] = MODULES.map((m) => {
        const mEvents = events.filter((e) => classify(e.screen_name as string | null, e.event_category as string | null, m.patterns))
        const mErrors = errors.filter((e) => classify(e.screen as string | null, null, m.patterns))
        const ev = mEvents.length
        const er = mErrors.length
        const status = moduleStatus(ev, er)
        const rateStr = ev > 0 ? ` (${((er / ev) * 100).toFixed(1)}% error rate)` : ''
        return {
          ...m,
          events: ev,
          errors: er,
          status,
          detail:
            ev === 0
              ? `No ${m.label} events captured yet. Integrate the PAAQ SDK and navigate the ${m.label} module.`
              : `${ev} event${ev !== 1 ? 's' : ''} captured${rateStr}. ${
                  status === 'healthy'
                    ? `${m.label} is operating normally.`
                    : status === 'warning'
                    ? `${er} error${er !== 1 ? 's' : ''} detected — monitor closely.`
                    : `Elevated error rate — ${m.label} needs attention.`
                }`,
        }
      })

      /* ── Infra nodes ── */
      const perfVals = (perf ?? []).map((r) => r.value as number)
      const avgRt = perfVals.length > 0 ? Math.round(perfVals.reduce((a, b) => a + b, 0) / perfVals.length) : 0
      const rtStatus: 'healthy' | 'warning' | 'critical' =
        avgRt === 0 ? 'healthy' : avgRt < 200 ? 'healthy' : avgRt < 500 ? 'warning' : 'critical'

      const openIncCount = openInc ?? 0
      const incStatus: 'healthy' | 'warning' | 'critical' =
        openIncCount === 0 ? 'healthy' : openIncCount < 2 ? 'warning' : 'critical'

      const infraNodes: InfraNode[] = [
        {
          id: 'api',
          label: 'API',
          sub: 'Backend · Node.js',
          Icon: Gauge,
          value: avgRt > 0 ? `${avgRt}ms` : '—',
          status: rtStatus,
          detail:
            avgRt === 0
              ? 'No performance metrics yet. Send metrics via the PAAQ SDK.'
              : `Average API response time: ${avgRt}ms. ${rtStatus === 'healthy' ? 'Well within SLA.' : rtStatus === 'warning' ? 'Approaching latency threshold.' : 'Above latency SLA — investigate.'}`,
        },
        {
          id: 'database',
          label: 'Database',
          sub: 'Supabase · Postgres',
          Icon: Database,
          value: incStatus === 'healthy' ? 'Healthy' : `${openIncCount} inc.`,
          status: incStatus,
          detail:
            openIncCount === 0
              ? 'No active incidents. All platform layers are nominal.'
              : `${openIncCount} active incident${openIncCount !== 1 ? 's' : ''} open. Visit the Incidents page to investigate.`,
        },
      ]

      setModules(moduleNodes)
      setInfra(infraNodes)

      /* Auto-select the first unhealthy node */
      const firstBad = moduleNodes.find((n) => n.status !== 'healthy' && n.status !== 'idle')
      if (firstBad) {
        setSelected({ label: firstBad.label, sub: firstBad.sub, status: firstBad.status, events: firstBad.events, errors: firstBad.errors, detail: firstBad.detail, accent: firstBad.accent })
      } else if (moduleNodes.length > 0) {
        const m = moduleNodes[0]
        setSelected({ label: m.label, sub: m.sub, status: m.status, events: m.events, errors: m.errors, detail: m.detail, accent: m.accent })
      }
      setLoading(false)
    })
  }, [app.id])

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHead title="PAAQ Platform Health" desc="Ask · Book · Attend · Learn" />
        <div className="px-5 pb-5">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-border/60 bg-card/60" />
            ))}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHead
        title="PAAQ Platform Health"
        desc="Real-time health of all four product modules and platform infrastructure"
        action={
          <ToneBadge
            tone={modules.some((m) => m.status === 'critical') ? 'critical' : modules.some((m) => m.status === 'warning') ? 'warning' : 'healthy'}
            dot
          >
            {modules.some((m) => m.status === 'critical')
              ? 'Degraded'
              : modules.some((m) => m.status === 'warning')
              ? 'Watch'
              : 'All healthy'}
          </ToneBadge>
        }
      />
      <div className="px-5 pb-5">
        {/* Module grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {/* 4 PAAQ modules */}
          {modules.map((m) => {
            const tone = statusToneOf(m.status)
            const sel = selected?.label === m.label
            const Icon = m.Icon
            return (
              <button
                key={m.id}
                onClick={() => setSelected({ label: m.label, sub: m.sub, status: m.status, events: m.events, errors: m.errors, detail: m.detail, accent: m.accent })}
                className={cn(
                  'group relative flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-all',
                  sel
                    ? 'border-intel/40 bg-intel/8 ring-1 ring-intel/20'
                    : 'border-border/60 bg-card/60 hover:border-border hover:bg-accent/30',
                )}
              >
                <div className="flex items-center justify-between">
                  <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg border', {
                    'border-intel/30 bg-intel/10 text-intel': m.accent === 'intel',
                    'border-healthy/30 bg-healthy/10 text-healthy': m.accent === 'healthy',
                    'border-ai/30 bg-ai/10 text-ai': m.accent === 'ai',
                    'border-warning/30 bg-warning/10 text-warning': m.accent === 'warning',
                  })}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <StatusDot tone={m.status === 'idle' ? 'intel' : m.status} pulse={m.status !== 'healthy' && m.status !== 'idle'} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground">{m.sub}</p>
                </div>
                <div className="flex items-end justify-between gap-1">
                  <p className={cn('text-sm font-bold tabular-nums', m.status === 'idle' ? 'text-muted-foreground' : toneText[tone])}>
                    {m.events > 0 ? m.events.toLocaleString() : '—'}
                  </p>
                  <span className={cn('text-[10px] font-semibold uppercase', {
                    'text-healthy': m.status === 'healthy',
                    'text-warning': m.status === 'warning',
                    'text-critical': m.status === 'critical',
                    'text-muted-foreground': m.status === 'idle',
                  })}>
                    {m.status}
                  </span>
                </div>
              </button>
            )
          })}

          {/* 2 infra nodes */}
          {infra.map((n) => {
            const sel = selected?.label === n.label
            const Icon = n.Icon
            return (
              <button
                key={n.id}
                onClick={() => setSelected({ label: n.label, sub: n.sub, status: n.status, value: n.value, detail: n.detail, accent: n.status as Tone })}
                className={cn(
                  'group relative flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-all',
                  sel
                    ? 'border-intel/40 bg-intel/8 ring-1 ring-intel/20'
                    : 'border-border/60 bg-card/40 hover:border-border hover:bg-accent/30',
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <StatusDot tone={n.status} pulse={n.status !== 'healthy'} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{n.label}</p>
                  <p className="text-[10px] text-muted-foreground">{n.sub}</p>
                </div>
                <div className="flex items-end justify-between gap-1">
                  <p className={cn('text-sm font-bold tabular-nums', toneText[n.status])}>{n.value}</p>
                  <span className={cn('text-[10px] font-semibold uppercase', toneText[n.status])}>
                    {n.status}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="mt-3 rounded-xl border border-border/60 bg-background/30 p-4 animate-rise">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className={cn('h-2.5 w-2.5 rounded-full', toneBg[statusToneOf(selected.status as 'healthy' | 'warning' | 'critical' | 'idle')])} />
                <h4 className="text-sm font-semibold text-foreground">{selected.label}</h4>
                <span className="text-xs text-muted-foreground">{selected.sub}</span>
                <ToneBadge tone={statusToneOf(selected.status as 'healthy' | 'warning' | 'critical' | 'idle')}>
                  {selected.status}
                </ToneBadge>
              </div>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selected.detail}</p>
            {(selected.events !== undefined || selected.value !== undefined) && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {selected.events !== undefined && (
                  <Stat label="Events" value={selected.events.toLocaleString()} tone={statusToneOf(selected.status as 'healthy' | 'warning' | 'critical' | 'idle')} />
                )}
                {selected.errors !== undefined && (
                  <Stat label="Errors" value={String(selected.errors)} tone={selected.errors > 0 ? 'critical' : 'healthy'} />
                )}
                {selected.value !== undefined && (
                  <Stat label="Metric" value={selected.value} tone={statusToneOf(selected.status as 'healthy' | 'warning' | 'critical' | 'idle')} />
                )}
                <Stat label="Module" value={selected.label} />
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-sm font-semibold tabular-nums', tone ? toneText[tone] : 'text-foreground')}>{value}</p>
    </div>
  )
}
