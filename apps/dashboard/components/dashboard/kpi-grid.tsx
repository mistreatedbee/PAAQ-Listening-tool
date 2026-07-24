'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Sparkline } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText } from '@/lib/tones'
import type { Tone } from '@/lib/data'

type KpiData = {
  label: string
  sub: string
  value: string
  tone: Tone
  spark: number[]
  pulse?: 'ai' | 'healthy'
}

const placeholder: KpiData[] = [
  { label: 'Org Health',       sub: 'AI score',         value: '—', tone: 'healthy',  spark: Array(8).fill(0) },
  { label: 'Active Users',     sub: 'last 24h',         value: '—', tone: 'intel',    spark: Array(8).fill(0) },
  { label: 'AI Coverage',      sub: 'entities learned', value: '—', tone: 'ai',       spark: Array(8).fill(0) },
  { label: 'Error Tracking',  sub: 'sessions OK',      value: '—', tone: 'healthy',  spark: Array(8).fill(0) },
  { label: 'Emerging Risks',   sub: 'active',           value: '—', tone: 'warning',  spark: Array(8).fill(0) },
  { label: 'AI Insights',      sub: 'generated',        value: '—', tone: 'ai',       spark: Array(8).fill(0) },
]

export function KpiGrid() {
  const { app } = useConnectedApp()
  const [kpis, setKpis] = useState<KpiData[]>(placeholder)

  useEffect(() => {
    if (app.id === '__loading__') return
    let cancelled = false
    const sb = createClient()

    function load() {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString()
      Promise.all([
        sb.from('events').select('user_id').gte('created_at', yesterday).eq('project_id', app.id),
        sb.from('events').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
        sb.from('errors').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('project_id', app.id),
        sb.from('incidents').select('*', { count: 'exact', head: true }).neq('status', 'resolved').eq('project_id', app.id),
        sb.from('ai_insights').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
        sb.from('sessions').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
        sb.from('knowledge_nodes').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      ]).then(([dauRaw, allEvents, errors, incidents, insights, sessions, knowledge]) => {
      if (cancelled) return
      const dauSet = new Set(
        ((dauRaw.data ?? []) as { user_id: string | null }[])
          .map((e) => e.user_id)
          .filter(Boolean),
      )
      const dau = dauSet.size
      const ev  = allEvents.count ?? 0
      const er  = errors.count ?? 0
      const inc = incidents.count ?? 0
      const ai  = insights.count ?? 0
      const ses = sessions.count ?? 0
      const kn  = knowledge.count ?? 0

      // Org health: 100 minus error and incident penalties
      const errorPenalty    = ev > 0 ? Math.min(40, Math.round((er / Math.max(ev, 1)) * 200)) : 0
      const incidentPenalty = Math.min(30, inc * 10)
      const health          = Math.max(10, 100 - errorPenalty - incidentPenalty)

      // AI coverage: knowledge entities as % of a target (100 entities = comprehensive)
      const coverage = kn > 0 ? Math.min(100, Math.round((kn / 100) * 100)) : 0

      // Error tracking: open errors as primary signal
      const workflowHealth = ses > 0
        ? Math.max(0, Math.min(100, Math.round(((ses - Math.min(er, ses)) / ses) * 100)))
        : 100

      setKpis([
        {
          label: 'Org Health',
          sub: 'AI score / 100',
          value: String(health),
          tone: health >= 80 ? 'healthy' : health >= 60 ? 'warning' : 'critical',
          spark: [70, 72, 75, 71, 78, 80, health - 3, health],
          pulse: health >= 80 ? 'healthy' : undefined,
        },
        {
          label: 'Active Users',
          sub: 'last 24h',
          value: dau > 0 ? dau.toLocaleString() : ev > 0 ? '—' : '0',
          tone: 'intel',
          spark: [0, 0, 0, 0, 0, 0, 0, dau],
        },
        {
          label: 'AI Coverage',
          sub: `${kn} entities learned`,
          value: kn > 0 ? `${coverage}%` : '0%',
          tone: 'ai',
          spark: [0, 0, 0, 0, 0, 0, 0, coverage],
          pulse: 'ai',
        },
        {
          label: 'Error Tracking',
          sub: 'sessions OK',
          value: `${workflowHealth}%`,
          tone: workflowHealth >= 90 ? 'healthy' : workflowHealth >= 70 ? 'warning' : 'critical',
          spark: [100, 98, 99, 97, 99, 98, workflowHealth + 1, workflowHealth],
        },
        {
          label: 'Emerging Risks',
          sub: 'active',
          value: inc.toLocaleString(),
          tone: inc > 0 ? 'warning' : 'healthy',
          spark: [0, 0, 0, 0, 0, 0, 0, inc],
        },
        {
          label: 'AI Insights',
          sub: 'generated',
          value: ai.toLocaleString(),
          tone: 'ai',
          spark: [0, 0, 0, 0, 0, 0, 0, ai],
          pulse: ai > 0 ? 'ai' : undefined,
        },
      ])
    })
    }  // end load()

    load()

    const channel = sb
      .channel(`kpi-refresh-${app.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `project_id=eq.${app.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'errors', filter: `project_id=eq.${app.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents', filter: `project_id=eq.${app.id}` }, load)
      .subscribe()

    const timer = setInterval(load, 30_000)

    return () => {
      cancelled = true
      clearInterval(timer)
      sb.removeChannel(channel)
    }
  }, [app.id])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="group relative overflow-hidden rounded-xl border border-border/70 bg-card/60 p-3.5 transition-all hover:border-border hover:bg-card/90"
        >
          <div className={cn(
            'pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100',
            k.tone === 'intel'   && 'bg-intel/[0.03]',
            k.tone === 'healthy' && 'bg-healthy/[0.03]',
            k.tone === 'critical'&& 'bg-critical/[0.04]',
            k.tone === 'warning' && 'bg-warning/[0.03]',
            k.tone === 'ai'      && 'bg-ai/[0.04]',
          )} />
          <div className="flex items-start justify-between gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {k.label}
            </p>
            {k.pulse && (
              <span className={cn(
                'h-1.5 w-1.5 rounded-full animate-pulse-dot shrink-0 mt-0.5',
                k.pulse === 'ai' ? 'bg-ai' : 'bg-healthy',
              )} />
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
