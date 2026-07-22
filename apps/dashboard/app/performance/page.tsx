'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, CardHead, AreaChart } from '@/components/kit'
import { cn } from '@/lib/utils'
import { toneText } from '@/lib/tones'
import { Gauge, Sparkles } from 'lucide-react'
import type { Tone } from '@/lib/data'

type MetricRow = {
  metric_type: string
  value: number
  created_at: string
}

type MetricSummary = {
  label: string
  value: string
  tone: Tone
  series: number[]
  rec: string
}

function buildSummaries(rows: MetricRow[]): MetricSummary[] {
  const byType: Record<string, number[]> = {}
  for (const r of rows) {
    if (!byType[r.metric_type]) byType[r.metric_type] = []
    byType[r.metric_type].push(r.value)
  }

  const summaries: MetricSummary[] = []
  for (const [type, vals] of Object.entries(byType)) {
    const avg = vals.reduce((a, v) => a + v, 0) / vals.length
    const series = vals.slice(-8)
    while (series.length < 8) series.unshift(avg)

    let tone: Tone = 'intel'
    let label = type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    let formatted = avg.toFixed(1)
    let rec = 'Monitoring normally.'

    if (type === 'response_time') {
      tone = avg < 200 ? 'healthy' : avg < 500 ? 'warning' : 'critical'
      formatted = `${Math.round(avg)}ms`
      rec = avg < 200 ? 'Excellent response times.' : 'Consider caching to reduce latency.'
    } else if (type === 'error_rate') {
      tone = avg < 0.5 ? 'healthy' : avg < 2 ? 'warning' : 'critical'
      formatted = `${avg.toFixed(2)}%`
      rec = avg < 0.5 ? 'Error rate within acceptable range.' : 'Investigate error spikes.'
    } else if (type === 'cpu') {
      tone = avg < 60 ? 'intel' : avg < 80 ? 'warning' : 'critical'
      formatted = `${Math.round(avg)}%`
      rec = avg > 75 ? 'CPU trending high — consider autoscaling.' : 'CPU utilisation healthy.'
    } else if (type === 'memory') {
      tone = avg < 60 ? 'intel' : avg < 80 ? 'warning' : 'critical'
      formatted = `${Math.round(avg)}%`
      rec = avg > 70 ? 'Memory trending up — check for leaks.' : 'Memory utilisation normal.'
    } else if (type === 'fps') {
      tone = avg >= 55 ? 'healthy' : avg >= 30 ? 'warning' : 'critical'
      formatted = `${Math.round(avg)} fps`
      rec = avg >= 55 ? 'App rendering smoothly.' : 'Frame drops detected — profile render pipeline.'
    }

    summaries.push({ label, value: formatted, tone, series, rec })
  }
  return summaries
}

export default function PerformancePage() {
  const [metrics, setMetrics] = useState<MetricSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.from('performance_metrics')
      .select('metric_type, value, created_at')
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data }) => {
        const rows = (data ?? []) as MetricRow[]
        setMetrics(buildSummaries(rows))
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">Loading…</div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Gauge className="h-5 w-5 text-intel" />}
        title="Performance Monitoring"
        desc="Aggregated metrics from the PAAQ SDK — response times, error rates, CPU, memory and FPS."
      />

      {metrics.length === 0 ? (
        <Card className="p-10 text-center">
          <Gauge className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No performance data yet. Metrics appear here automatically once your app is integrated with the PAAQ SDK.</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {metrics.map((m) => (
            <Card key={m.label}>
              <CardHead
                title={m.label}
                action={<span className={cn('text-lg font-semibold tabular-nums', toneText[m.tone])}>{m.value}</span>}
              />
              <div className="px-5">
                <AreaChart data={m.series} tone={m.tone} height={130} labels={['older', '', '', 'recent']} />
              </div>
              <div className="mx-5 mb-5 mt-3 flex items-start gap-2 rounded-lg border border-ai/20 bg-ai/[0.05] p-3">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ai" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-medium text-ai">AI: </span>{m.rec}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHead
          title="Predicted Capacity"
          desc="AI forecast across compute, storage and database"
        />
        <div className="p-10 text-center">
          <Gauge className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">
            Capacity forecasting will appear here once infrastructure metrics are flowing in from your app.
          </p>
        </div>
      </Card>
    </div>
  )
}
