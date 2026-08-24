'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Insight } from '@/lib/data'
import { Card, Confidence, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneBg } from '@/lib/tones'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Sparkles, Users, TrendingUp, ArrowRight } from 'lucide-react'
import { AiButton } from '@/components/kit-ai-button'
import { AiProgressModal, type AiProgress } from '@/components/kit-ai-progress-modal'

const INVESTIGATE_STAGES = [
  'Collecting live telemetry…',
  'Reading errors and sessions…',
  'Mapping to source files…',
  'Agents correlating evidence…',
  'Preparing recommendations…',
]

export function InsightCard({ insight, compact }: { insight: Insight; compact?: boolean }) {
  const { app } = useConnectedApp()
  const router = useRouter()
  const [investigating, setInvestigating] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)

  const handleInvestigate = async () => {
    if (app.id === '__loading__' || investigating) return
    setInvestigating(true)
    setProgressOpen(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ project_id: app.id }),
      })
      const data = await res.json()
      if (res.ok && data.investigation_id) {
        router.push(`/investigations/${data.investigation_id}`)
        return
      }
    } catch {
      // fall through — button just re-enables below
    }
    setProgressOpen(false)
    setInvestigating(false)
  }

  // Navigation unmounts this card; keep the modal visible until then.
  const progress: AiProgress = {
    title: insight.title,
    stages: INVESTIGATE_STAGES,
    agents: ['incident', 'root_cause', 'product', 'ux', 'qa', 'performance', 'security', 'executive'],
  }

  return (
    <Card className="flex flex-col p-4 transition-colors hover:border-border">
      <AiProgressModal
        open={progressOpen}
        onClose={() => setProgressOpen(false)}
        progress={progress}
      />
      <div className="flex items-start gap-3">
        <span className={cn('mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', 'bg-ai/12 text-ai')}>
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-pretty text-sm font-semibold leading-snug text-foreground">{insight.title}</h3>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{insight.summary}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Confidence value={insight.confidence} />
        <ToneBadge tone={insight.severity} dot>
          {insight.impact}
        </ToneBadge>
        {insight.affected !== '—' && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" /> {insight.affected}
          </span>
        )}
      </div>

      {!compact && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
          {insight.actions.map((a, i) => {
            const isInvestigate = a === 'Investigate'
            if (isInvestigate) {
              return (
                <AiButton
                  key={a}
                  onClick={handleInvestigate}
                  busy={investigating}
                  idleLabel="Investigate"
                  busyLabel="Agents investigating…"
                  stages={[
                    'Reading telemetry…',
                    'Mapping to source files…',
                    'Agents investigating…',
                    'Preparing recommendations…',
                  ]}
                  icon={<TrendingUp className="h-3.5 w-3.5" />}
                  className="px-2.5 py-1.5 text-xs"
                />
              )
            }
            return (
              <button
                key={a}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  i === 0
                    ? 'bg-ai text-ai-foreground hover:opacity-90'
                    : 'border border-border/70 bg-card/60 text-foreground hover:bg-accent',
                )}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {a}
              </button>
            )
          })}
          <Link href={`/ai-insights/${insight.id}`} className="ml-auto flex items-center gap-1 text-xs font-medium text-intel hover:underline">
            Details <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </Card>
  )
}
