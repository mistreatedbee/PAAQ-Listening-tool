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
  value: string
  unit?: string
  delta: number
  tone: Tone
  spark: number[]
}

const placeholder: KpiData[] = [
  { label: 'Total Events', value: '—', delta: 0, tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
  { label: 'Active Sessions', value: '—', delta: 0, tone: 'healthy', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
  { label: 'Total Users', value: '—', delta: 0, tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
  { label: 'Open Errors', value: '—', delta: 0, tone: 'critical', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
  { label: 'Projects', value: '—', delta: 0, tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
  { label: 'Open Incidents', value: '—', delta: 0, tone: 'warning', spark: [0, 0, 0, 0, 0, 0, 0, 0] },
]

export function KpiGrid() {
  const [kpis, setKpis] = useState<KpiData[]>(placeholder)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('events').select('*', { count: 'exact', head: true }),
      sb.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      sb.from('users').select('*', { count: 'exact', head: true }),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      sb.from('projects').select('*', { count: 'exact', head: true }),
      sb.from('incidents').select('*', { count: 'exact', head: true }).neq('status', 'resolved'),
    ]).then(([events, sessions, users, errors, projects, incidents]) => {
      const ev = events.count ?? 0
      const se = sessions.count ?? 0
      const us = users.count ?? 0
      const er = errors.count ?? 0
      const pr = projects.count ?? 0
      const inc = incidents.count ?? 0
      setKpis([
        { label: 'Total Events', value: ev.toLocaleString(), delta: 0, tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, ev] },
        { label: 'Active Sessions', value: se.toLocaleString(), delta: 0, tone: se > 0 ? 'healthy' : 'intel', spark: [0, 0, 0, 0, 0, 0, 0, se] },
        { label: 'Total Users', value: us.toLocaleString(), delta: 0, tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, us] },
        { label: 'Open Errors', value: er.toLocaleString(), delta: 0, tone: er > 0 ? 'critical' : 'healthy', spark: [0, 0, 0, 0, 0, 0, 0, er] },
        { label: 'Projects', value: pr.toLocaleString(), delta: 0, tone: 'intel', spark: [0, 0, 0, 0, 0, 0, 0, pr] },
        { label: 'Open Incidents', value: inc.toLocaleString(), delta: 0, tone: inc > 0 ? 'warning' : 'healthy', spark: [0, 0, 0, 0, 0, 0, 0, inc] },
      ])
    })
  }, [])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {kpis.map((k) => {
        const up = k.delta > 0
        const flat = k.delta === 0
        const negativeMetric = ['Open Incidents', 'Open Errors'].includes(k.label)
        const deltaTone = flat
          ? 'text-muted-foreground'
          : (up ? !negativeMetric : negativeMetric)
            ? 'text-healthy'
            : 'text-critical'
        return (
          <div
            key={k.label}
            className="group relative overflow-hidden rounded-xl border border-border/70 bg-card/60 p-3.5 transition-colors hover:border-border"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="flex items-baseline gap-1">
                <span className={cn('text-2xl font-semibold tabular-nums tracking-tight', toneText[k.tone])}>
                  {k.value}
                </span>
                {k.unit && <span className="text-xs text-muted-foreground">{k.unit}</span>}
              </p>
              <Sparkline data={k.spark} tone={k.tone} width={64} height={26} />
            </div>
            <div className={cn('mt-2 flex items-center gap-1 text-[11px] font-medium', deltaTone)}>
              {flat ? <Minus className="h-3 w-3" /> : up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {flat ? 'live' : `${up ? '+' : ''}${k.delta}`}
              <span className="text-muted-foreground">from Supabase</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
