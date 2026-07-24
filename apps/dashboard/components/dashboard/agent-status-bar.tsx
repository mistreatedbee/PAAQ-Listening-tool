'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { cn } from '@/lib/utils'
import { toneText, toneSoft } from '@/lib/tones'
import { Globe, Network, Route, BookOpen, Gauge, Shield } from 'lucide-react'
import type { Tone } from '@/lib/data'

type AgentDef = {
  id: string
  shortName: string
  focus: string
  tone: Tone
  Icon: typeof Globe
}

const AGENTS: AgentDef[] = [
  { id: 'discovery',    shortName: 'Discovery',    focus: 'Exploring application structure, navigation flows, and feature areas',            tone: 'intel',    Icon: Globe },
  { id: 'api',          shortName: 'API Intel',     focus: 'Mapping API endpoints, schemas, request patterns, and service dependencies',      tone: 'healthy',  Icon: Network },
  { id: 'journey',      shortName: 'User Journey',  focus: 'Observing user interactions, drop-offs, frustration signals, and workflow gaps',  tone: 'ai',       Icon: Route },
  { id: 'knowledge',    shortName: 'Knowledge',     focus: 'Building and indexing organisational knowledge, docs, and operational memory',    tone: 'warning',  Icon: BookOpen },
  { id: 'performance',  shortName: 'Performance',   focus: 'Monitoring response times, slow pages, API latency, and infrastructure health',   tone: 'intel',    Icon: Gauge },
  { id: 'security',     shortName: 'Security',      focus: 'Detecting anomalies, access pattern changes, and emerging security signals',      tone: 'critical', Icon: Shield },
]

export function AgentStatusBar() {
  const { app } = useConnectedApp()
  const [insightCount, setInsightCount] = useState<number | null>(null)
  const [lastAgent, setLastAgent] = useState<string | null>(null)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()
    Promise.all([
      sb.from('ai_insights').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      sb.from('ai_insights').select('agent').eq('project_id', app.id).order('created_at', { ascending: false }).limit(1),
    ]).then(([{ count }, { data }]) => {
      setInsightCount(count ?? 0)
      setLastAgent((data?.[0] as { agent?: string })?.agent ?? null)
    })
  }, [app.id])

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-4 py-2.5">
      {/* Status indicator */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-ai opacity-70 animate-pulse-dot" />
          <span className="relative h-2 w-2 rounded-full bg-ai" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          AI Agents Learning
        </span>
        {insightCount !== null && (
          <span className="rounded-full border border-border/60 bg-background/50 px-2 py-0 text-[10px] font-medium text-muted-foreground">
            {insightCount} insights generated
          </span>
        )}
      </div>

      {/* Agent chips */}
      <div className="ml-auto hidden items-center gap-1.5 xl:flex">
        {AGENTS.map((a) => {
          const isActive = lastAgent === a.id
          const Icon = a.Icon
          return (
            <div
              key={a.id}
              title={a.focus}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all',
                isActive ? toneSoft[a.tone] : 'border-border/40 bg-background/40 text-muted-foreground/70',
              )}
            >
              <Icon className={cn('h-3 w-3', isActive ? toneText[a.tone] : 'opacity-50')} />
              {a.shortName}
              {isActive && <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse-dot', `bg-current`)} />}
            </div>
          )
        })}
      </div>

      {/* Mobile: brief status */}
      <div className="xl:hidden ml-auto">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-ai">
          <span className="h-1.5 w-1.5 rounded-full bg-ai animate-pulse-dot" />
          6 agents active
        </span>
      </div>
    </div>
  )
}
