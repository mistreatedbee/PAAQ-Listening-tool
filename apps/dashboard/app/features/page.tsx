'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { PageHeader, Card, CardHead, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import { Blocks, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { Tone } from '@/lib/data'

type Feature = {
  id: string
  feature_name: string
  health_score: number
  usage_score: number
  error_score: number
  completion_rate: number
  event_count: number
  error_count: number
  trend: string
  ai_summary: string | null
}

function healthTone(score: number): Tone {
  if (score >= 0.8) return 'healthy'
  if (score >= 0.6) return 'warning'
  return 'critical'
}

function healthLabel(score: number) {
  if (score >= 0.8) return 'Healthy'
  if (score >= 0.6) return 'Needs attention'
  return 'Critical'
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'improving') return <TrendingUp className="h-3.5 w-3.5 text-healthy" />
  if (trend === 'declining') return <TrendingDown className="h-3.5 w-3.5 text-critical" />
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
}

export default function FeaturesPage() {
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const fetchFeatures = async () => {
    const sb = createClient()
    const { data } = await sb
      .from('feature_health')
      .select('*')
      .order('health_score', { ascending: true })
    setFeatures((data ?? []) as Feature[])
    setLoading(false)
  }

  useEffect(() => { fetchFeatures() }, [])

  const runAnalysis = async () => {
    setAnalysing(true)
    showToast('Running AI analysis across all features…')
    const sb = createClient()
    const { data, error } = await sb.functions.invoke('analyze')
    if (error) {
      showToast('Analysis failed — check ANTHROPIC_API_KEY is set in Supabase')
    } else {
      await fetchFeatures()
      showToast(`Analysis complete — ${data?.features ?? 0} features scored, ${data?.insights ?? 0} insights generated`)
    }
    setAnalysing(false)
  }

  const critical = features.filter((f) => f.health_score < 0.6).length
  const healthy = features.filter((f) => f.health_score >= 0.8).length

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        icon={<Blocks className="h-5 w-5" />}
        title="Feature Health"
        desc="Every feature scored on usage, errors and completion — with AI-generated analysis and recommendations."
        actions={
          <button
            onClick={runAnalysis}
            disabled={analysing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ai px-3 py-1.5 text-sm font-medium text-ai-foreground hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${analysing ? 'animate-spin' : ''}`} />
            {analysing ? 'Analysing…' : 'Run AI Analysis'}
          </button>
        }
      />

      {features.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Features tracked', value: features.length, tone: 'text-foreground' },
            { label: 'Critical', value: critical, tone: 'text-critical' },
            { label: 'Healthy', value: healthy, tone: 'text-healthy' },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className={`mt-1.5 text-2xl font-semibold ${s.tone}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : features.length === 0 ? (
        <Card className="p-10 text-center">
          <Blocks className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-20" />
          <p className="text-sm font-medium text-foreground">No feature data yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Send events via the PAAQ SDK, then click "Run AI Analysis" to score your features.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {features.map((f) => {
            const tone = healthTone(f.health_score)
            const pct = Math.round(f.health_score * 100)
            return (
              <Card key={f.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-foreground">{f.feature_name}</h3>
                      <TrendIcon trend={f.trend} />
                      <ToneBadge tone={tone}>{healthLabel(f.health_score)}</ToneBadge>
                    </div>
                    {f.ai_summary && (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.ai_summary}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn('text-2xl font-bold tabular-nums', {
                      'text-healthy': tone === 'healthy',
                      'text-warning': tone === 'warning',
                      'text-critical': tone === 'critical',
                    })}>{pct}%</p>
                    <p className="text-[10px] text-muted-foreground">health</p>
                  </div>
                </div>

                {/* Health bar */}
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                  <div
                    className={cn('h-full rounded-full transition-all', {
                      'bg-healthy': tone === 'healthy',
                      'bg-warning': tone === 'warning',
                      'bg-critical': tone === 'critical',
                    })}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Events', value: f.event_count },
                    { label: 'Errors', value: f.error_count },
                    { label: 'Completion', value: `${Math.round(f.completion_rate * 100)}%` },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-border/50 bg-card/60 py-1.5">
                      <p className="text-xs font-semibold text-foreground">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
