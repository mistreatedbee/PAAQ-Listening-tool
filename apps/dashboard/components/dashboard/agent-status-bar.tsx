'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'
import { toneText, toneSoft } from '@/lib/tones'
import { AlertCircle, BarChart2, CheckCircle2, Shield, Gauge, FileText } from 'lucide-react'
import type { Tone } from '@/lib/data'

type AgentDef = {
  id: string
  shortName: string
  focus: string
  tone: Tone
  Icon: typeof AlertCircle
}

const AGENTS: AgentDef[] = [
  { id: 'incident', shortName: 'Incident', focus: 'Monitoring all active incidents in real time', tone: 'critical', Icon: AlertCircle },
  { id: 'product', shortName: 'Product', focus: 'Analysing usage patterns across Ask, Book, Attend, Learn', tone: 'intel', Icon: BarChart2 },
  { id: 'qa', shortName: 'QA', focus: 'Tracking test coverage and regression signals', tone: 'healthy', Icon: CheckCircle2 },
  { id: 'security', shortName: 'Security', focus: 'Monitoring auth anomalies, OTP patterns, device tokens', tone: 'warning', Icon: Shield },
  { id: 'performance', shortName: 'Perf', focus: 'Tracking API latency, DB query times, Agora session health', tone: 'intel', Icon: Gauge },
  { id: 'executive', shortName: 'Reporter', focus: 'Composing executive-ready summaries for leadership', tone: 'ai', Icon: FileText },
]

export function AgentStatusBar() {
  const [insightCount, setInsightCount] = useState<number | null>(null)
  const [lastAgent, setLastAgent] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('ai_insights').select('*', { count: 'exact', head: true }),
      sb.from('ai_insights').select('agent').order('created_at', { ascending: false }).limit(1),
    ]).then(([{ count }, { data }]) => {
      setInsightCount(count ?? 0)
      setLastAgent((data?.[0] as { agent?: string })?.agent ?? null)
    })
  }, [])

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-4 py-2.5">
      {/* Status indicator */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-healthy opacity-70 animate-pulse-dot" />
          <span className="relative h-2 w-2 rounded-full bg-healthy" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          AI Agents
        </span>
        {insightCount !== null && (
          <span className="rounded-full border border-border/60 bg-background/50 px-2 py-0 text-[10px] font-medium text-muted-foreground">
            {insightCount} insights
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

      {/* Mobile: just badge count */}
      <div className="xl:hidden ml-auto">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-healthy">
          <span className="h-1.5 w-1.5 rounded-full bg-healthy" />
          6 agents active
        </span>
      </div>
    </div>
  )
}
