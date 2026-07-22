'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Sparkline } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText } from '@/lib/tones'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { Tone } from '@/lib/data'

type KpiData = {
  label: string
  sub: string
  value: string
  tone: Tone
  spark: number[]
  badge?: string
}

const placeholder: KpiData[] = [
  { label: 'Active Users', sub: 'last 24 h', value: '—', tone: 'intel', spark: Array(8).fill(0) },
  { label: 'Live Sessions', sub: 'now', value: '—', tone: 'healthy', spark: Array(8).fill(0) },
  { label: 'Events', sub: 'last 24 h', value: '—', tone: 'intel', spark: Array(8).fill(0) },
  { label: 'Open Errors', sub: 'unresolved', value: '—', tone: 'critical', spark: Array(8).fill(0) },
  { label: 'Incidents', sub: 'active', value: '—', tone: 'warning', spark: Array(8).fill(0) },
  { label: 'AI Insights', sub: 'total', value: '—', tone: 'ai', spark: Array(8).fill(0) },
]

export function KpiGrid() {
  const [kpis, setKpis] = useState<KpiData[]>(placeholder)

  useEffect(() => {
    const sb = createClient()
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()

    Promise.all([
      sb.from('events').select('user_id').gte('created_at', yesterday),
      sb.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      sb.from('events').select('*', { count: 'exact', head: true }).gte('created_at', yesterday),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      sb.from('incidents').select('*', { count: 'exact', head: true }).neq('status', 'resolved'),
      sb.from('ai_insights').select('*', { count: 'exact', head: true }),
    ]).then(([dauRaw, sessions, events24h, errors, incidents, insights]) => {
      const dauSet = new Set(
        ((dauRaw.data ?? []) as { user_id: string | null }[])
          .map((e) => e.user_id)
          .filter(Boolean),
      )
      const dau = dauSet.size
      const se = sessions.count ?? 0
      const ev = events24h.count ?? 0
      const er = errors.count ?? 0
      const inc = incidents.count ?? 0
      const ai = insights.count ?? 0

      setKpis([
        {
          label: 'Active Users',
          sub: 'last 24 h',
          value: dau > 0 ? dau.toLocaleString() : ev > 0 ? '—' : '0',
          tone: 'intel',
          spark: [0, 0, 0, 0, 0, 0, 0, dau],
        },
        {
          label: 'Live Sessions',
          sub: 'now',
          value: se.toLocaleString(),
          tone: se > 0 ? 'healthy' : 'intel',
          spark: [0, 0, 0, 0, 0, 0, 0, se],
          badge: se > 0 ? 'live' : undefined,
        },
        {
          label: 'Events',
          sub: 'last 24 h',
          value: ev.toLocaleString(),
          tone: 'intel',
          spark: [0, 0, 0, 0, 0, 0, 0, ev],
        },
        {
          label: 'Open Errors',
          sub: 'unresolved',
          value: er.toLocaleString(),
          tone: er > 0 ? 'critical' : 'healthy',
          spark: [0, 0, 0, 0, 0, 0, 0, er],
        },
        {
          label: 'Incidents',
          sub: 'active',
          value: inc.toLocaleString(),
          tone: inc > 0 ? 'warning' : 'healthy',
          spark: [0, 0, 0, 0, 0, 0, 0, inc],
        },
        {
          label: 'AI Insights',
          sub: 'total',
          value: ai.toLocaleString(),
          tone: 'ai',
          spark: [0, 0, 0, 0, 0, 0, 0, ai],
        },
      ])
    })
  }, [])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="group relative overflow-hidden rounded-xl border border-border/70 bg-card/60 p-3.5 transition-all hover:border-border hover:bg-card/90"
        >
          {/* subtle tone glow on hover */}
          <div className={cn(
            'pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100',
            k.tone === 'intel' && 'bg-intel/[0.03]',
            k.tone === 'healthy' && 'bg-healthy/[0.03]',
            k.tone === 'critical' && 'bg-critical/[0.04]',
            k.tone === 'warning' && 'bg-warning/[0.03]',
            k.tone === 'ai' && 'bg-ai/[0.04]',
          )} />
          <div className="flex items-start justify-between gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {k.label}
            </p>
            {k.badge === 'live' && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-healthy">
                <span className="h-1.5 w-1.5 rounded-full bg-healthy animate-pulse-dot" />
              </span>
            )}
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <p className={cn('text-2xl font-semibold tabular-nums tracking-tight', toneText[k.tone])}>
              {k.value}
            </p>
            <Sparkline data={k.spark} tone={k.tone} width={56} height={24} />
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground/70">{k.sub}</p>
        </div>
      ))}
    </div>
  )
}
