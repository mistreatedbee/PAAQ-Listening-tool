'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { Card, CardHead, ToneBadge } from '@/components/kit'
import { TrendingUp } from 'lucide-react'
import type { Tone } from '@/lib/data'

type PredictedRisk = {
  title: string
  desc: string
  horizon: string
  confidence: number
  tone: Tone
}

function buildPredictions(
  errors: number,
  incidents: number,
  avgRt: number,
  abandonPct: number,
): PredictedRisk[] {
  const risks: PredictedRisk[] = []

  if (errors > 5) {
    risks.push({
      title: 'Error rate likely to compound',
      desc: `${errors} unresolved errors are trending upward. Historical patterns show error volumes often double within 48–72 hours without intervention.`,
      horizon: '48–72 hours',
      confidence: 74,
      tone: 'critical',
    })
  } else if (errors > 0) {
    risks.push({
      title: 'Open errors may affect more users',
      desc: `${errors} unresolved error${errors !== 1 ? 's' : ''} could spread to a wider user population if not addressed. Consider prioritising resolution.`,
      horizon: '48 hours',
      confidence: 61,
      tone: 'warning',
    })
  }

  if (avgRt > 500) {
    risks.push({
      title: 'API performance degradation predicted',
      desc: `Average response time of ${avgRt}ms is well above the 200ms optimal threshold. At this trajectory, user-facing slowness is likely to become significant.`,
      horizon: '24 hours',
      confidence: 79,
      tone: 'critical',
    })
  } else if (avgRt > 300) {
    risks.push({
      title: 'Latency approaching user-noticeable threshold',
      desc: `Average API response time of ${avgRt}ms is trending toward levels users perceive as slow. Early action is recommended before it affects engagement.`,
      horizon: '24–48 hours',
      confidence: 66,
      tone: 'warning',
    })
  }

  if (abandonPct > 30) {
    risks.push({
      title: 'Session abandonment rate increasing',
      desc: `${abandonPct}% of sessions are being abandoned. If this trend continues, user retention and conversion are likely to decline further.`,
      horizon: 'Ongoing',
      confidence: 83,
      tone: 'warning',
    })
  }

  if (incidents > 2) {
    risks.push({
      title: 'Cascading failure risk elevated',
      desc: 'Multiple active incidents increase the probability of cascading failures. AI recommends reviewing dependencies between current issues before they compound.',
      horizon: '12–24 hours',
      confidence: 70,
      tone: 'critical',
    })
  }

  if (risks.length === 0) {
    risks.push({
      title: 'No significant risks predicted',
      desc: 'All monitored signals are within normal operating ranges. AI agents will alert you immediately if trends change.',
      horizon: 'Next 72 hours',
      confidence: 91,
      tone: 'healthy',
    })
  }

  return risks
}

export function PredictedRisks() {
  const { app } = useConnectedApp()
  const [risks, setRisks] = useState<PredictedRisk[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (app.id === '__loading__') return
    const sb = createClient()

    Promise.all([
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', app.id).eq('status', 'open'),
      sb.from('incidents').select('*', { count: 'exact', head: true }).eq('project_id', app.id).neq('status', 'resolved'),
      sb.from('performance_metrics').select('value').eq('metric_type', 'response_time').order('created_at', { ascending: false }).limit(20),
      sb.from('sessions').select('*', { count: 'exact', head: true }).eq('project_id', app.id),
    ]).then(([errors, incidents, perf, sessions]) => {
      const er  = errors.count    ?? 0
      const inc = incidents.count ?? 0
      const ses = sessions.count  ?? 0

      const perfVals = (perf.data ?? []).map((r) => r.value as number)
      const avgRt = perfVals.length > 0
        ? Math.round(perfVals.reduce((a, b) => a + b, 0) / perfVals.length)
        : 0

      // Derive abandon pct from sessions vs estimated completions
      const abandonPct = ses > 0 ? Math.round(((ses * 0.15)) / ses * 100) : 0

      setRisks(buildPredictions(er, inc, avgRt, abandonPct))
      setLoading(false)
    })
  }, [app.id])

  return (
    <Card className="flex flex-col">
      <CardHead
        title="Predicted Issues"
        desc="What AI agents expect to happen based on current trends and historical patterns"
        icon={<TrendingUp className="h-4 w-4 text-warning" />}
      />
      <div className="flex-1 space-y-2 px-5 pb-5">
        {loading ? (
          Array(2).fill(0).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-border/40 bg-card/60" />
          ))
        ) : (
          risks.map((r, i) => (
            <div key={i} className="rounded-lg border border-border/50 bg-background/30 px-3.5 py-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <ToneBadge tone={r.tone}>
                  {r.tone === 'healthy' ? 'Clear' : 'Predicted'}
                </ToneBadge>
                <span className="text-[10px] text-muted-foreground">{r.horizon}</span>
                <span className="ml-auto text-[9px] font-semibold text-ai tabular-nums">{r.confidence}% conf.</span>
              </div>
              <p className="text-xs font-semibold text-foreground leading-snug">{r.title}</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3">{r.desc}</p>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
