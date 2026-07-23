'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useConnectedApp } from '@/components/shell/connected-app-context'
import { PageHeader, Card, CardHead, ToneBadge } from '@/components/kit'
import { cn } from '@/lib/utils'
import { FileText, Sparkles, RefreshCw, CheckCircle2, AlertTriangle, TrendingUp, Zap, Shield } from 'lucide-react'
import type { Tone } from '@/lib/data'

type DbInsight = {
  id: string
  category: string
  title: string
  description: string | null
  confidence: number | null
  recommendation: string | null
  recommended_action: string | null
  priority: string | null
}

type ReportData = {
  generatedAt: string
  users: number
  sessions: number
  errors: { total: number; open: number; critical: number }
  openIncidents: number
  pendingRecs: number
  insights: DbInsight[]
  topFeatures: { feature_name: string; health_score: number; trend: string }[]
  perfAvgs: { metric_type: string; avg: number }[]
}

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  error: <AlertTriangle className="h-4 w-4 text-critical" />,
  warning: <AlertTriangle className="h-4 w-4 text-warning" />,
  performance: <Zap className="h-4 w-4 text-intel" />,
  growth: <TrendingUp className="h-4 w-4 text-healthy" />,
  success: <CheckCircle2 className="h-4 w-4 text-healthy" />,
  security: <Shield className="h-4 w-4 text-warning" />,
}

const PRIORITY_TONE: Record<string, Tone> = {
  critical: 'critical',
  high: 'warning',
  medium: 'intel',
  low: 'intel',
}

function healthLabel(score: number) {
  if (score >= 0.8) return 'Healthy'
  if (score >= 0.6) return 'Needs attention'
  return 'Critical'
}

function healthTone(score: number): Tone {
  if (score >= 0.8) return 'healthy'
  if (score >= 0.6) return 'warning'
  return 'critical'
}

export default function ReportsPage() {
  const { app } = useConnectedApp()
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const loadReport = async (projectId: string) => {
    const sb = createClient()
    const [
      { data: insights },
      { count: sessions },
      { count: errTotal },
      { count: errOpen },
      { count: errCrit },
      { count: openIncidents },
      { data: features },
      { data: perf },
    ] = await Promise.all([
      sb.from('ai_insights')
        .select('id, category, title, description, confidence, recommendation, recommended_action, priority')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20),
      sb.from('sessions').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', projectId),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'open'),
      sb.from('errors').select('*', { count: 'exact', head: true }).eq('project_id', projectId).in('severity', ['fatal', 'error']).eq('status', 'open'),
      sb.from('incidents').select('*', { count: 'exact', head: true }).eq('project_id', projectId).neq('status', 'resolved'),
      sb.from('feature_health').select('feature_name, health_score, trend').order('health_score').limit(10),
      sb.from('performance_metrics').select('metric_type, value').limit(500),
    ])

    // Aggregate perf averages
    const perfMap: Record<string, number[]> = {}
    for (const p of perf ?? []) {
      const k = p.metric_type as string
      if (!perfMap[k]) perfMap[k] = []
      perfMap[k].push(p.value as number)
    }
    const perfAvgs = Object.entries(perfMap).map(([metric_type, vals]) => ({
      metric_type,
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    }))

    setReport({
      generatedAt: new Date().toISOString(),
      users: 0,
      sessions: sessions ?? 0,
      errors: { total: errTotal ?? 0, open: errOpen ?? 0, critical: errCrit ?? 0 },
      openIncidents: openIncidents ?? 0,
      pendingRecs: 0,
      insights: (insights ?? []) as DbInsight[],
      topFeatures: (features ?? []) as { feature_name: string; health_score: number; trend: string }[],
      perfAvgs,
    })
    setLoading(false)
  }

  useEffect(() => {
    if (app.id === '__loading__') return
    loadReport(app.id)
  }, [app.id])

  const handleGenerate = async () => {
    setGenerating(true)
    showToast('Running full AI analysis with Claude…')
    const sb = createClient()
    const { data, error } = await sb.functions.invoke('analyze')
    if (error) {
      showToast('Failed — make sure ANTHROPIC_API_KEY is set in Supabase Edge Function secrets')
    } else {
      showToast(`Analysis complete — ${data?.insights ?? 'new'} insights generated`)
      await loadReport(app.id)
    }
    setGenerating(false)
  }

  const criticalInsights = report?.insights.filter((i) => i.priority === 'critical' || i.category === 'error') ?? []
  const otherInsights = report?.insights.filter((i) => i.priority !== 'critical' && i.category !== 'error') ?? []

  return (
    <div className="flex flex-col gap-6">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader
        icon={<FileText className="h-5 w-5" />}
        title="Reports"
        desc="AI-generated executive report drawn from live platform data — errors, performance, features and recommendations."
        actions={
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-ai px-3 py-2 text-sm font-medium text-ai-foreground transition hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating…' : 'Generate report'}
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-32 text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'Users', value: report!.users, tone: 'intel' as Tone },
              { label: 'Sessions', value: report!.sessions, tone: 'intel' as Tone },
              { label: 'Total errors', value: report!.errors.total, tone: (report!.errors.total > 0 ? 'warning' : 'healthy') as Tone },
              { label: 'Open errors', value: report!.errors.open, tone: (report!.errors.open > 0 ? 'critical' : 'healthy') as Tone },
              { label: 'Open incidents', value: report!.openIncidents, tone: (report!.openIncidents > 0 ? 'critical' : 'healthy') as Tone },
              { label: 'Pending actions', value: report!.pendingRecs, tone: (report!.pendingRecs > 0 ? 'warning' : 'intel') as Tone },
            ].map((s) => (
              <Card key={s.label} className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className={cn('mt-1.5 text-2xl font-semibold tabular-nums', {
                  'text-foreground': s.tone === 'intel',
                  'text-healthy': s.tone === 'healthy',
                  'text-warning': s.tone === 'warning',
                  'text-critical': s.tone === 'critical',
                })}>{s.value}</p>
              </Card>
            ))}
          </div>

          {report!.insights.length === 0 ? (
            <Card className="border-ai/20 bg-ai/[0.04] p-8 text-center">
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-ai opacity-40" />
              <p className="text-sm font-medium text-foreground">No AI insights yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Click "Generate report" to run full AI analysis and populate this report.
              </p>
            </Card>
          ) : (
            <>
              {/* Report header */}
              <div className="flex items-center justify-between rounded-xl border border-ai/20 bg-ai/[0.04] px-5 py-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-ai" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">AI Executive Report</p>
                    <p className="text-xs text-muted-foreground">
                      Generated {new Date(report!.generatedAt).toLocaleString()} · {report!.insights.length} insights · Claude AI
                    </p>
                  </div>
                </div>
              </div>

              {/* Critical issues */}
              {criticalInsights.length > 0 && (
                <Card>
                  <CardHead
                    title="Critical Issues"
                    desc="Needs immediate attention"
                    icon={<AlertTriangle className="h-4 w-4 text-critical" />}
                    action={<ToneBadge tone="critical" dot>{criticalInsights.length} critical</ToneBadge>}
                  />
                  <div className="divide-y divide-border/40">
                    {criticalInsights.map((ins) => (
                      <div key={ins.id} className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">
                            {CATEGORY_ICON[ins.category] ?? <AlertTriangle className="h-4 w-4 text-critical" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{ins.title}</p>
                              {ins.priority && (
                                <ToneBadge tone={PRIORITY_TONE[ins.priority] ?? 'intel'}>{ins.priority}</ToneBadge>
                              )}
                            </div>
                            {ins.description && (
                              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{ins.description}</p>
                            )}
                            {(ins.recommendation ?? ins.recommended_action) && (
                              <div className="mt-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recommended action</p>
                                <p className="mt-0.5 text-xs text-foreground">{ins.recommendation ?? ins.recommended_action}</p>
                              </div>
                            )}
                          </div>
                          {ins.confidence != null && (
                            <span className="shrink-0 text-xs font-semibold text-ai">
                              {Math.round(ins.confidence * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Other insights */}
              {otherInsights.length > 0 && (
                <Card>
                  <CardHead
                    title="Findings &amp; Observations"
                    desc="Trends, growth signals, and items to watch"
                    icon={<Sparkles className="h-4 w-4 text-ai" />}
                  />
                  <div className="divide-y divide-border/40">
                    {otherInsights.map((ins) => (
                      <div key={ins.id} className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 shrink-0">
                            {CATEGORY_ICON[ins.category] ?? <Sparkles className="h-4 w-4 text-ai" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{ins.title}</p>
                              {ins.priority && (
                                <ToneBadge tone={PRIORITY_TONE[ins.priority] ?? 'intel'}>{ins.priority}</ToneBadge>
                              )}
                              <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize">
                                {ins.category}
                              </span>
                            </div>
                            {ins.description && (
                              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{ins.description}</p>
                            )}
                            {(ins.recommendation ?? ins.recommended_action) && (
                              <p className="mt-1.5 text-xs font-medium text-intel">
                                → {ins.recommendation ?? ins.recommended_action}
                              </p>
                            )}
                          </div>
                          {ins.confidence != null && (
                            <span className="shrink-0 text-xs font-semibold text-ai">
                              {Math.round(ins.confidence * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Performance & Features side by side */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Performance */}
                {report!.perfAvgs.length > 0 && (
                  <Card>
                    <CardHead title="Performance Summary" desc="Averages across all captured metrics" icon={<Zap className="h-4 w-4 text-intel" />} />
                    <ul className="divide-y divide-border/40">
                      {report!.perfAvgs.map((m) => {
                        let unit = ''
                        let tone: Tone = 'intel'
                        if (m.metric_type === 'response_time') { unit = 'ms'; tone = m.avg < 200 ? 'healthy' : m.avg < 500 ? 'warning' : 'critical' }
                        if (m.metric_type === 'error_rate') { unit = '%'; tone = m.avg < 0.5 ? 'healthy' : m.avg < 2 ? 'warning' : 'critical' }
                        if (m.metric_type === 'cpu' || m.metric_type === 'memory') { unit = '%'; tone = m.avg < 60 ? 'intel' : m.avg < 80 ? 'warning' : 'critical' }
                        if (m.metric_type === 'fps') { unit = ' fps'; tone = m.avg >= 55 ? 'healthy' : m.avg >= 30 ? 'warning' : 'critical' }
                        return (
                          <li key={m.metric_type} className="flex items-center justify-between px-5 py-2.5">
                            <span className="text-sm text-foreground capitalize">{m.metric_type.replace(/_/g, ' ')}</span>
                            <span className={cn('text-sm font-semibold tabular-nums', {
                              'text-foreground': tone === 'intel',
                              'text-healthy': tone === 'healthy',
                              'text-warning': tone === 'warning',
                              'text-critical': tone === 'critical',
                            })}>{m.avg}{unit}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </Card>
                )}

                {/* Feature health */}
                {report!.topFeatures.length > 0 && (
                  <Card>
                    <CardHead title="Feature Health" desc="Scored from usage, errors and completion" />
                    <ul className="divide-y divide-border/40">
                      {report!.topFeatures.map((f) => {
                        const tone = healthTone(f.health_score)
                        return (
                          <li key={f.feature_name} className="flex items-center justify-between gap-3 px-5 py-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm text-foreground">{f.feature_name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border/60">
                                <div
                                  className={cn('h-full rounded-full', {
                                    'bg-healthy': tone === 'healthy',
                                    'bg-warning': tone === 'warning',
                                    'bg-critical': tone === 'critical',
                                  })}
                                  style={{ width: `${Math.round(f.health_score * 100)}%` }}
                                />
                              </div>
                              <ToneBadge tone={tone}>{healthLabel(f.health_score)}</ToneBadge>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </Card>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
