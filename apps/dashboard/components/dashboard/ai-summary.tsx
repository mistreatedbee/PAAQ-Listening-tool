'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card, CardHead } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText } from '@/lib/tones'
import { Sparkles } from 'lucide-react'
import type { Tone } from '@/lib/data'

type Stats = {
  health: number
  healthLabel: string
  healthTone: Tone
  activeUsers: number
  sessions: number
  errors: number
  incidents: number
  knowledge: number
  insights: number
}

function buildSummary(s: Stats, appName: string): string {
  const status = s.health >= 85
    ? 'healthy and operating normally'
    : s.health >= 65
    ? 'operating with some concerns that warrant attention'
    : 'experiencing significant issues that require immediate action'

  const userPart = s.activeUsers > 0
    ? `${s.activeUsers.toLocaleString()} active user${s.activeUsers !== 1 ? 's' : ''} tracked today across ${s.sessions.toLocaleString()} session${s.sessions !== 1 ? 's' : ''}`
    : s.sessions > 0
    ? `${s.sessions.toLocaleString()} session${s.sessions !== 1 ? 's' : ''} recorded`
    : 'no user activity recorded yet'

  const knowledgePart = s.knowledge > 0
    ? ` AI agents have discovered ${s.knowledge} knowledge entities and are continuously expanding their understanding.`
    : ' AI agents are actively exploring the connected system and building their knowledge base.'

  const insightPart = s.insights > 0
    ? ` ${s.insights} AI insight${s.insights !== 1 ? 's' : ''} ${s.insights === 1 ? 'has' : 'have'} been generated.`
    : ''

  const riskPart = s.incidents > 0
    ? ` ${s.incidents} active risk${s.incidents !== 1 ? 's' : ''} ${s.incidents === 1 ? 'requires' : 'require'} attention.`
    : ' No active risks detected.'

  const errorPart = s.errors > 0
    ? ` ${s.errors} unresolved error${s.errors !== 1 ? 's' : ''} detected.`
    : ''

  return `${appName} is ${status}. There ${s.activeUsers === 1 ? 'is' : 'are'} currently ${userPart}.${knowledgePart}${insightPart}${riskPart}${errorPart}`
}

const STAT_DEFS = [
  { key: 'health',      label: 'Intelligence Score', suffix: '/100' },
  { key: 'activeUsers', label: 'Active Users',       suffix: '' },
  { key: 'sessions',    label: 'Sessions',           suffix: '' },
  { key: 'errors',      label: 'Open Errors',        suffix: '' },
  { key: 'incidents',   label: 'Active Risks',       suffix: '' },
  { key: 'insights',    label: 'AI Insights',        suffix: '' },
] as const

function statTone(key: string, val: number): Tone {
  if (key === 'health')    return val >= 80 ? 'healthy' : val >= 60 ? 'warning' : 'critical'
  if (key === 'errors')    return val > 0 ? 'critical' : 'healthy'
  if (key === 'incidents') return val > 0 ? 'warning' : 'healthy'
  if (key === 'insights')  return 'ai'
  return 'intel'
}

export function AiSummary() {
  const { app } = useConnectedApp()
  const [stats, setStats] = useState<Stats | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()

    Promise.all([
      sb.from('events').select('user_id').gte('created_at', yesterday).eq('project_id', app.id),
      sb.from('events').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('project_id', app.id),
      sb.from('incidents').select('*', { count: 'exact', head: true }).neq('status', 'resolved').eq('project_id', app.id),
      sb.from('knowledge_nodes').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      sb.from('sessions').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      sb.from('ai_insights').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
    ]).then(([dauRaw, allEvents, errors, incidents, knowledge, sessions, insights]) => {
      const dauSet = new Set(
        ((dauRaw.data ?? []) as { user_id: string | null }[])
          .map((e) => e.user_id).filter(Boolean),
      )
      const dau = dauSet.size
      const ev  = allEvents.count ?? 0
      const er  = errors.count ?? 0
      const inc = incidents.count ?? 0
      const kn  = knowledge.count ?? 0
      const ses = sessions.count ?? 0
      const ai  = insights.count ?? 0

      const errorPenalty    = ev > 0 ? Math.min(40, Math.round((er / Math.max(ev, 1)) * 200)) : 0
      const incidentPenalty = Math.min(30, inc * 10)
      const health          = Math.max(10, 100 - errorPenalty - incidentPenalty)
      const healthTone: Tone = health >= 80 ? 'healthy' : health >= 60 ? 'warning' : 'critical'
      const healthLabel = health >= 85 ? 'Excellent' : health >= 70 ? 'Good' : health >= 55 ? 'Fair' : 'Needs attention'

      const s: Stats = { health, healthLabel, healthTone, activeUsers: dau, sessions: ses, errors: er, incidents: inc, knowledge: kn, insights: ai }
      setStats(s)
      setSummary(buildSummary(s, app.name))
      setLoading(false)
    })
  }, [app.id])

  return (
    <Card>
      <CardHead
        title="AI Summary"
        desc="Natural-language overview of what is happening in your organisation right now"
        icon={<Sparkles className="h-4 w-4 text-ai" />}
        action={
          stats && (
            <span className={cn('text-sm font-bold tabular-nums', toneText[stats.healthTone])}>
              {stats.health}<span className="text-xs font-semibold text-muted-foreground">/100</span>
            </span>
          )
        }
      />
      <div className="px-5 pb-5 space-y-4">
        {loading ? (
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-3/4 animate-pulse rounded-md bg-muted" />
          </div>
        ) : (
          <>
            {/* Natural language narrative */}
            <p className="text-sm leading-relaxed text-foreground/90">{summary}</p>

            {/* Inline stat strip */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {stats && STAT_DEFS.map(({ key, label, suffix }) => {
                const val = stats[key as keyof Stats] as number
                const tone = statTone(key, val)
                return (
                  <div key={key} className="rounded-lg border border-border/50 bg-background/30 px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wide text-muted-foreground/70 leading-tight">{label}</p>
                    <p className={cn('mt-1 text-lg font-bold tabular-nums leading-none', toneText[tone])}>
                      {val.toLocaleString()}{suffix}
                    </p>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
