'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card, CardHead } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText, toneBg } from '@/lib/tones'
import { BrainCircuit, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import type { Tone } from '@/lib/data'

type CoverageLayer = {
  label: string
  detail: string
  coverage: number
  tone: Tone
}

export function KnowledgeCoverage() {
  const { app } = useConnectedApp()
  const [layers, setLayers] = useState<CoverageLayer[]>([])
  const [overall, setOverall] = useState(0)
  const [knTotal, setKnTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()

    Promise.all([
      sb.from('knowledge_nodes').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      sb.from('events').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      sb.from('sessions').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
      sb.from('performance_metrics').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
    ]).then(([knowledge, events, sessions, perf]) => {
      const kn  = knowledge.count ?? 0
      const ev  = events.count   ?? 0
      const ses = sessions.count ?? 0
      const pm  = perf.count     ?? 0

      const fe = app.sdkStatus.frontend  === 'connected'
      const be = app.sdkStatus.backend   === 'connected'
      const db = app.sdkStatus.database  === 'connected'

      const webCoverage  = fe ? Math.min(100, ev > 0  ? Math.round((ev / 500)   * 100) : 10) : 0
      const apiCoverage  = be ? Math.min(100, kn > 0  ? Math.round((kn / 30)    * 100) : 8)  : 0
      const dbCoverage   = db ? Math.min(100, pm > 0  ? Math.round((pm / 200)   * 100) : 40) : 0
      const bwCoverage   = ses > 0 ? Math.min(100, Math.round((ses / 50)  * 100)) : 0
      const knCoverage   = kn > 0 ? Math.min(100, Math.round((kn / 100) * 100))  : 0

      const coverageLayers: CoverageLayer[] = [
        {
          label: 'Web Application',
          detail: fe ? (ev > 0 ? `${ev.toLocaleString()} interactions captured` : 'Connected — awaiting data') : 'SDK not connected',
          coverage: webCoverage,
          tone: fe ? (webCoverage >= 60 ? 'healthy' : 'ai') : 'intel',
        },
        {
          label: 'Backend Services',
          detail: be ? (kn > 0 ? `${kn} service patterns discovered` : 'Learning services') : 'SDK not connected',
          coverage: apiCoverage,
          tone: be ? (apiCoverage >= 60 ? 'healthy' : 'ai') : 'intel',
        },
        {
          label: 'APIs',
          detail: be ? 'Endpoints being mapped and indexed' : 'SDK not connected',
          coverage: apiCoverage,
          tone: be ? 'ai' : 'intel',
        },
        {
          label: 'Database',
          detail: db ? (pm > 0 ? `${pm} performance metrics collected` : 'Connector active — learning schema') : 'Connector not configured',
          coverage: dbCoverage,
          tone: db ? (dbCoverage >= 60 ? 'healthy' : 'ai') : 'intel',
        },
        {
          label: 'Business Workflows',
          detail: ses > 0 ? `${ses.toLocaleString()} user journeys analysed` : 'Awaiting session data',
          coverage: bwCoverage,
          tone: bwCoverage >= 60 ? 'healthy' : bwCoverage > 0 ? 'ai' : 'intel',
        },
      ]

      const avg = Math.round(coverageLayers.reduce((s, l) => s + l.coverage, 0) / coverageLayers.length)
      setLayers(coverageLayers)
      setOverall(avg)
      setKnTotal(kn)
      setLoading(false)
    })
  }, [app.id])

  return (
    <Card>
      <CardHead
        title="Knowledge Coverage"
        desc="How much of your application AI agents have discovered and understood"
        icon={<BrainCircuit className="h-4 w-4 text-ai" />}
        action={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">Overall</span>
              <span className="text-sm font-bold tabular-nums text-ai">{overall}%</span>
            </div>
            <Link href="/knowledge/graph" className="flex items-center gap-1 text-xs font-medium text-intel hover:underline">
              Graph <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
      />
      <div className="px-5 pb-5 space-y-3">
        {loading ? (
          Array(5).fill(0).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg border border-border/40 bg-card/60" />
          ))
        ) : (
          <>
            {layers.map((layer) => (
              <div key={layer.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-xs font-semibold text-foreground shrink-0">{layer.label}</span>
                    <span className="truncate text-[10px] text-muted-foreground/60">{layer.detail}</span>
                  </div>
                  <span className={cn('shrink-0 text-xs font-bold tabular-nums', toneText[layer.tone])}>
                    {layer.coverage}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-700 ease-out', toneBg[layer.tone])}
                    style={{ width: `${layer.coverage}%` }}
                  />
                </div>
              </div>
            ))}
            {knTotal > 0 && (
              <p className="pt-1 text-center text-[10px] text-muted-foreground/50">
                {knTotal} knowledge entities indexed · agents are continuously learning
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  )
}
